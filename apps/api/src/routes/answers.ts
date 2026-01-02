import { sha256, toBase64Url, fromBase64Url } from '@askbox/crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { answerRetrievalRateLimit, answerCreationRateLimit } from '../utils/rateLimit.js';

// Schemas
const createPublicAnswerSchema = z.object({
  visibility: z.literal('public'),
  public_text: z.string().min(1),
});

const createPrivateAnswerSchema = z.object({
  visibility: z.literal('private'),
  ciphertext_answer: z.string().min(1),
  nonce: z.string().min(1),
  dek_for_owner: z.string().min(1),
  dek_for_asker: z.string().min(1),
});

const createAnswerSchema = z.union([createPublicAnswerSchema, createPrivateAnswerSchema]);

const publishAnswerSchema = z.object({
  public_text: z.string().min(1),
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

export async function answerRoutes(app: FastifyInstance) {
  // POST /v1/questions/:question_id/answer - Create an answer
  app.post('/questions/:question_id/answer', {
    preHandler: [authenticate, answerCreationRateLimit],
  }, async (request: FastifyRequest<{
    Params: { question_id: string }
  }>, reply: FastifyReply) => {
    const { question_id } = request.params;
    const body = createAnswerSchema.parse(request.body);
    const userId = (request.user as { user_id: string }).user_id;

    // Find question and verify ownership
    const question = await prisma.question.findUnique({
      where: { id: question_id },
      include: { box: true, answer: true },
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

    if (question.answer) {
      return reply.status(409).send({
        error: {
          code: 'ALREADY_ANSWERED',
          message: 'This question has already been answered',
        },
      });
    }

    // Create answer based on visibility
    const answerData: any = {
      questionId: question_id,
      visibility: body.visibility,
    };

    if (body.visibility === 'public') {
      // Check size limit
      if (body.public_text.length > config.sizeLimits.answerMaxBytes) {
        return reply.status(400).send({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Answer exceeds maximum size of ${config.sizeLimits.answerMaxBytes} bytes`,
          },
        });
      }
      answerData.publicText = body.public_text;
    } else {
      // Private answer
      const ciphertextBytes = fromBase64Url(body.ciphertext_answer);
      if (ciphertextBytes.length > config.sizeLimits.answerMaxBytes) {
        return reply.status(400).send({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Answer exceeds maximum size of ${config.sizeLimits.answerMaxBytes} bytes`,
          },
        });
      }

      answerData.ciphertextAnswer = Buffer.from(ciphertextBytes);
      answerData.nonce = Buffer.from(fromBase64Url(body.nonce));
      answerData.dekForOwner = Buffer.from(fromBase64Url(body.dek_for_owner));
      answerData.dekForAsker = Buffer.from(fromBase64Url(body.dek_for_asker));
    }

    const answer = await prisma.answer.create({ data: answerData });

    return reply.status(201).send({
      answer_id: answer.id,
      created_at: answer.createdAt.toISOString(),
    });
  });

  // GET /v1/questions/:question_id/answer - Get public answer
  app.get('/questions/:question_id/answer', async (request: FastifyRequest<{
    Params: { question_id: string }
  }>, reply: FastifyReply) => {
    const { question_id } = request.params;

    const answer = await prisma.answer.findUnique({
      where: { questionId: question_id },
    });

    if (!answer) {
      return reply.status(404).send({
        error: {
          code: 'ANSWER_NOT_FOUND',
          message: 'Answer not found',
        },
      });
    }

    if (answer.visibility === 'private' && !answer.publicText) {
      return reply.send({
        answer_id: answer.id,
        visibility: 'private',
      });
    }

    return reply.send({
      answer_id: answer.id,
      visibility: answer.visibility,
      public_text: answer.publicText,
      created_at: answer.createdAt.toISOString(),
      published_at: answer.publishedAt?.toISOString() || null,
    });
  });

  // GET /v1/asker/answers - Get answer for asker (with asker_token)
  app.get('/asker/answers', {
    preHandler: answerRetrievalRateLimit,
  }, async (request: FastifyRequest<{
    Querystring: { asker_token: string; question_id: string }
  }>, reply: FastifyReply) => {
    const { asker_token, question_id } = request.query;

    if (!asker_token || !question_id) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'asker_token and question_id are required',
        },
      });
    }

    // Verify asker token
    const tokenHash = sha256(fromBase64Url(asker_token));

    const question = await prisma.question.findFirst({
      where: {
        id: question_id,
        askerTokenHash: Buffer.from(tokenHash),
      },
      include: { answer: true },
    });

    if (!question) {
      return reply.status(404).send({
        error: {
          code: 'QUESTION_NOT_FOUND',
          message: 'Question not found or invalid token',
        },
      });
    }

    if (!question.answer) {
      return reply.status(404).send({
        error: {
          code: 'ANSWER_NOT_FOUND',
          message: 'This question has not been answered yet',
        },
      });
    }

    const answer = question.answer;

    if (answer.visibility === 'public' || answer.publicText) {
      return reply.send({
        answer_id: answer.id,
        visibility: answer.publicText ? 'public' : answer.visibility,
        public_text: answer.publicText,
        created_at: answer.createdAt.toISOString(),
      });
    }

    // Return encrypted answer for asker to decrypt
    return reply.send({
      answer_id: answer.id,
      visibility: 'private',
      ciphertext_answer: answer.ciphertextAnswer
        ? toBase64Url(new Uint8Array(answer.ciphertextAnswer))
        : null,
      nonce: answer.nonce
        ? toBase64Url(new Uint8Array(answer.nonce))
        : null,
      dek_for_asker: answer.dekForAsker
        ? toBase64Url(new Uint8Array(answer.dekForAsker))
        : null,
      created_at: answer.createdAt.toISOString(),
    });
  });

  // GET /v1/owner/answers/:question_id - Get answer for owner (with encrypted data)
  app.get('/owner/answers/:question_id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest<{
    Params: { question_id: string }
  }>, reply: FastifyReply) => {
    const { question_id } = request.params;
    const userId = (request.user as { user_id: string }).user_id;

    const question = await prisma.question.findUnique({
      where: { id: question_id },
      include: { box: true, answer: true },
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

    if (!question.answer) {
      return reply.status(404).send({
        error: {
          code: 'ANSWER_NOT_FOUND',
          message: 'This question has not been answered yet',
        },
      });
    }

    const answer = question.answer;

    return reply.send({
      answer_id: answer.id,
      visibility: answer.visibility,
      public_text: answer.publicText,
      ciphertext_answer: answer.ciphertextAnswer
        ? toBase64Url(new Uint8Array(answer.ciphertextAnswer))
        : null,
      nonce: answer.nonce
        ? toBase64Url(new Uint8Array(answer.nonce))
        : null,
      dek_for_owner: answer.dekForOwner
        ? toBase64Url(new Uint8Array(answer.dekForOwner))
        : null,
      created_at: answer.createdAt.toISOString(),
      published_at: answer.publishedAt?.toISOString() || null,
    });
  });

  // POST /v1/answers/:answer_id/publish - Publish private answer
  app.post('/answers/:answer_id/publish', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest<{
    Params: { answer_id: string }
  }>, reply: FastifyReply) => {
    const { answer_id } = request.params;
    const body = publishAnswerSchema.parse(request.body);
    const userId = (request.user as { user_id: string }).user_id;

    // Find answer and verify ownership
    const answer = await prisma.answer.findUnique({
      where: { id: answer_id },
      include: { question: { include: { box: true } } },
    });

    if (!answer) {
      return reply.status(404).send({
        error: {
          code: 'ANSWER_NOT_FOUND',
          message: 'Answer not found',
        },
      });
    }

    if (answer.question.box.ownerUserId !== userId) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not own this answer',
        },
      });
    }

    if (answer.visibility === 'public' && answer.publicText) {
      return reply.status(409).send({
        error: {
          code: 'ALREADY_PUBLIC',
          message: 'This answer is already public',
        },
      });
    }

    // Update answer to public
    const updatedAnswer = await prisma.answer.update({
      where: { id: answer_id },
      data: {
        publicText: body.public_text,
        publishedAt: new Date(),
      },
    });

    return reply.send({
      visibility: 'public',
      published_at: updatedAnswer.publishedAt!.toISOString(),
    });
  });
}
