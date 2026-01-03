import { randomBytes, sha256, toBase64Url, fromBase64Url } from '@askbox/crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { notifyNewQuestion } from '../services/pushService.js';
import { questionRateLimit } from '../utils/rateLimit.js';

// Schemas
const createQuestionSchema = z.object({
  ciphertext_question: z.string().min(1),
  receipt_pub_enc_key: z.string().optional(),
  client_created_at: z.string().datetime(),
});

const openQuestionSchema = z.object({
  opened_at: z.string().datetime(),
  opened_sig: z.string().optional(),
});

// Auth decorator
async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing authentication token',
      },
    });
  }
}

export async function questionRoutes(app: FastifyInstance) {
  // POST /v1/boxes/:box_id/questions - Submit a question
  app.post<{ Params: { box_id: string } }>(
    '/boxes/:box_id/questions',
    {
      preHandler: questionRateLimit,
    },
    async (request, reply) => {
      const { box_id } = request.params;
      const body = createQuestionSchema.parse(request.body);

      // Check size limit
      const ciphertextBytes = fromBase64Url(body.ciphertext_question);
      if (ciphertextBytes.length > config.sizeLimits.questionMaxBytes) {
        return reply.status(400).send({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Question exceeds maximum size of ${config.sizeLimits.questionMaxBytes} bytes`,
          },
        });
      }

      // Find box
      const box = await prisma.box.findUnique({
        where: { id: box_id },
      });

      if (!box) {
        return reply.status(404).send({
          error: {
            code: 'BOX_NOT_FOUND',
            message: 'Box not found',
          },
        });
      }

      // Generate asker token
      const askerToken = toBase64Url(randomBytes(32));
      const askerTokenHash = sha256(fromBase64Url(askerToken));

      // Create question
      const question = await prisma.question.create({
        data: {
          boxId: box_id,
          ciphertextQuestion: Buffer.from(ciphertextBytes),
          receiptPubEncKey: body.receipt_pub_enc_key
            ? Buffer.from(fromBase64Url(body.receipt_pub_enc_key))
            : null,
          askerTokenHash: Buffer.from(askerTokenHash),
        },
      });

      // Send push notification to box owner (fire and forget)
      notifyNewQuestion(box_id).catch((err) => {
        request.log.error({ err }, 'Failed to send push notification');
      });

      return reply.status(201).send({
        question_id: question.id,
        asker_token: askerToken,
      });
    }
  );

  // GET /v1/owner/questions - List questions for owner
  app.get<{ Querystring: { status?: string; box_id?: string; limit?: string; offset?: string } }>(
    '/owner/questions',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const userId = (request.user as { user_id: string }).user_id;
      const { status, box_id, limit = '20', offset = '0' } = request.query;

      // Build where clause
      const where: any = {
        box: { ownerUserId: userId },
      };

      if (box_id) {
        where.boxId = box_id;
      }

      if (status === 'unopened') {
        where.openedAt = null;
      } else if (status === 'opened') {
        where.openedAt = { not: null };
        where.answer = null;
      } else if (status === 'answered') {
        where.answer = { isNot: null };
      }

      const [questions, total] = await Promise.all([
        prisma.question.findMany({
          where,
          include: { answer: { select: { id: true, visibility: true } } },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit),
          skip: parseInt(offset),
        }),
        prisma.question.count({ where }),
      ]);

      return reply.send({
        questions: questions.map((q) => ({
          question_id: q.id,
          box_id: q.boxId,
          ciphertext_question: toBase64Url(new Uint8Array(q.ciphertextQuestion)),
          receipt_pub_enc_key: q.receiptPubEncKey
            ? toBase64Url(new Uint8Array(q.receiptPubEncKey))
            : null,
          created_at: q.createdAt.toISOString(),
          opened_at: q.openedAt?.toISOString() || null,
          has_answer: !!q.answer,
        })),
        total,
        has_more: parseInt(offset) + questions.length < total,
      });
    }
  );

  // POST /v1/questions/:question_id/open - Mark question as opened
  app.post<{ Params: { question_id: string } }>(
    '/questions/:question_id/open',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { question_id } = request.params;
      const body = openQuestionSchema.parse(request.body);
      const userId = (request.user as { user_id: string }).user_id;

      // Find question and verify ownership
      const question = await prisma.question.findUnique({
        where: { id: question_id },
        include: { box: true },
      });

      if (!question) {
        return reply.status(404).send({
          error: {
            code: 'QUESTION_NOT_FOUND',
            message: 'Question not found',
          },
        });
      }

      if (question.box.ownerUserId !== userId) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not own this question',
          },
        });
      }

      // Update question
      await prisma.question.update({
        where: { id: question_id },
        data: {
          openedAt: new Date(body.opened_at),
          openedSig: body.opened_sig ? Buffer.from(fromBase64Url(body.opened_sig)) : null,
        },
      });

      return reply.send({ ok: true });
    }
  );
}
