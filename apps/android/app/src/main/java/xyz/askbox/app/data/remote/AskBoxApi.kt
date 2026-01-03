package xyz.askbox.app.data.remote

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.*

interface AskBoxApi {

    // ========================================
    // Auth
    // ========================================

    @POST("auth/challenge")
    suspend fun requestChallenge(@Body request: ChallengeRequest): ChallengeResponse

    @POST("auth/verify")
    suspend fun verifyChallenge(@Body request: VerifyRequest): VerifyResponse

    // ========================================
    // Boxes
    // ========================================

    @POST("boxes")
    suspend fun createBox(
        @Header("Authorization") token: String,
        @Body request: CreateBoxRequest
    ): CreateBoxResponse

    @GET("boxes/{slug}")
    suspend fun getBox(@Path("slug") slug: String): GetBoxResponse

    @GET("owner/boxes")
    suspend fun getMyBoxes(@Header("Authorization") token: String): MyBoxesResponse

    // ========================================
    // Questions
    // ========================================

    @POST("boxes/{boxId}/questions")
    suspend fun createQuestion(
        @Path("boxId") boxId: String,
        @Body request: CreateQuestionRequest
    ): CreateQuestionResponse

    @GET("owner/questions")
    suspend fun getQuestions(
        @Header("Authorization") token: String,
        @Query("box_id") boxId: String? = null,
        @Query("status") status: String? = null
    ): QuestionsResponse

    @POST("questions/{questionId}/open")
    suspend fun openQuestion(
        @Header("Authorization") token: String,
        @Path("questionId") questionId: String,
        @Body request: OpenQuestionRequest
    ): OpenQuestionResponse

    // ========================================
    // Answers
    // ========================================

    @POST("questions/{questionId}/answer")
    suspend fun createAnswer(
        @Header("Authorization") token: String,
        @Path("questionId") questionId: String,
        @Body request: CreateAnswerRequest
    ): CreateAnswerResponse

    @GET("questions/{questionId}/answer")
    suspend fun getPublicAnswer(
        @Path("questionId") questionId: String
    ): GetAnswerResponse

    @GET("asker/answers")
    suspend fun getAskerAnswer(
        @Query("question_id") questionId: String,
        @Query("asker_token") askerToken: String
    ): GetAskerAnswerResponse

    // ========================================
    // Push Notifications
    // ========================================

    @POST("push/subscribe/fcm")
    suspend fun subscribeFcm(
        @Header("Authorization") token: String,
        @Body request: FcmSubscribeRequest
    ): SimpleResponse

    @POST("push/unsubscribe")
    suspend fun unsubscribePush(
        @Header("Authorization") token: String,
        @Body request: UnsubscribeRequest
    ): SimpleResponse
}

// ========================================
// Request/Response DTOs
// ========================================

@Serializable
data class ChallengeRequest(
    @SerialName("pub_sign_key") val pubSignKey: String,
    @SerialName("pub_enc_key") val pubEncKey: String? = null
)

@Serializable
data class ChallengeResponse(
    val nonce: String,
    @SerialName("challenge_id") val challengeId: String,
    @SerialName("expires_at") val expiresAt: String
)

@Serializable
data class VerifyRequest(
    @SerialName("challenge_id") val challengeId: String,
    val signature: String
)

@Serializable
data class VerifyResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("expires_in") val expiresIn: Int,
    @SerialName("user_id") val userId: String
)

@Serializable
data class CreateBoxRequest(
    val slug: String? = null,
    val settings: BoxSettings = BoxSettings()
)

@Serializable
data class BoxSettings(
    @SerialName("allow_anonymous") val allowAnonymous: Boolean = true,
    @SerialName("require_captcha") val requireCaptcha: Boolean = false
)

@Serializable
data class CreateBoxResponse(
    @SerialName("box_id") val boxId: String,
    val slug: String,
    @SerialName("owner_pub_enc_key") val ownerPubEncKey: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class GetBoxResponse(
    @SerialName("box_id") val boxId: String,
    val slug: String,
    val settings: BoxSettings,
    @SerialName("owner_pub_enc_key") val ownerPubEncKey: String
)

@Serializable
data class MyBoxesResponse(
    val boxes: List<BoxItem>
)

@Serializable
data class BoxItem(
    @SerialName("box_id") val boxId: String,
    val slug: String,
    val settings: BoxSettings,
    @SerialName("owner_pub_enc_key") val ownerPubEncKey: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class CreateQuestionRequest(
    @SerialName("ciphertext_question") val ciphertextQuestion: String,
    @SerialName("receipt_pub_enc_key") val receiptPubEncKey: String? = null,
    @SerialName("client_created_at") val clientCreatedAt: String
)

@Serializable
data class CreateQuestionResponse(
    @SerialName("question_id") val questionId: String,
    @SerialName("asker_token") val askerToken: String
)

@Serializable
data class QuestionsResponse(
    val questions: List<QuestionItem>
)

@Serializable
data class QuestionItem(
    @SerialName("question_id") val questionId: String,
    @SerialName("box_id") val boxId: String,
    @SerialName("ciphertext_question") val ciphertextQuestion: String,
    @SerialName("receipt_pub_enc_key") val receiptPubEncKey: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("opened_at") val openedAt: String?,
    @SerialName("has_answer") val hasAnswer: Boolean
)

@Serializable
data class OpenQuestionRequest(
    @SerialName("opened_at") val openedAt: String,
    @SerialName("opened_sig") val openedSig: String? = null
)

@Serializable
data class OpenQuestionResponse(
    val ok: Boolean
)

@Serializable
data class CreateAnswerRequest(
    val visibility: String,
    @SerialName("public_text") val publicText: String? = null,
    @SerialName("ciphertext_answer") val ciphertextAnswer: String? = null,
    val nonce: String? = null,
    @SerialName("dek_for_owner") val dekForOwner: String? = null,
    @SerialName("dek_for_asker") val dekForAsker: String? = null
)

@Serializable
data class CreateAnswerResponse(
    @SerialName("answer_id") val answerId: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class GetAnswerResponse(
    @SerialName("answer_id") val answerId: String,
    val visibility: String,
    @SerialName("public_text") val publicText: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("published_at") val publishedAt: String? = null
)

@Serializable
data class GetAskerAnswerResponse(
    @SerialName("answer_id") val answerId: String,
    val visibility: String,
    @SerialName("public_text") val publicText: String? = null,
    @SerialName("ciphertext_answer") val ciphertextAnswer: String? = null,
    val nonce: String? = null,
    @SerialName("dek_for_asker") val dekForAsker: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("published_at") val publishedAt: String? = null
)

@Serializable
data class ApiError(
    val error: ErrorDetail
)

@Serializable
data class ErrorDetail(
    val code: String,
    val message: String
)

// Push notifications
@Serializable
data class FcmSubscribeRequest(
    @SerialName("fcmToken") val fcmToken: String
)

@Serializable
data class UnsubscribeRequest(
    val endpoint: String
)

@Serializable
data class SimpleResponse(
    val ok: Boolean
)
