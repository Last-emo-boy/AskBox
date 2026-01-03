package xyz.askbox.app.util

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.net.Uri
import androidx.core.content.FileProvider
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import java.io.File
import java.io.FileOutputStream

object ShareUtils {
    private const val BASE_URL = "https://askbox.w33d.xyz"
    
    fun getBoxUrl(slug: String): String {
        return "$BASE_URL/box/$slug"
    }
    
    /**
     * Generate QR code bitmap
     */
    fun generateQRCode(content: String, size: Int = 512): Bitmap {
        val writer = QRCodeWriter()
        val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size)
        
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        for (x in 0 until size) {
            for (y in 0 until size) {
                bitmap.setPixel(x, y, if (bitMatrix[x, y]) Color.BLACK else Color.WHITE)
            }
        }
        return bitmap
    }
    
    /**
     * Generate share poster with QR code
     */
    fun generatePoster(slug: String, url: String): Bitmap {
        val width = 800
        val height = 1000
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        
        // Background gradient
        val gradient = LinearGradient(
            0f, 0f, width.toFloat(), height.toFloat(),
            intArrayOf(0xFF667eea.toInt(), 0xFF764ba2.toInt()),
            null,
            Shader.TileMode.CLAMP
        )
        paint.shader = gradient
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        paint.shader = null
        
        // Title
        paint.color = Color.WHITE
        paint.textSize = 56f
        paint.textAlign = Paint.Align.CENTER
        paint.isFakeBoldText = true
        canvas.drawText("向我提问吧！", width / 2f, 120f, paint)
        
        // Subtitle
        paint.textSize = 32f
        paint.isFakeBoldText = false
        paint.alpha = 200
        canvas.drawText("匿名提问，端到端加密", width / 2f, 180f, paint)
        paint.alpha = 255
        
        // QR Code background
        paint.color = Color.WHITE
        val qrBgRect = RectF(200f, 240f, 600f, 640f)
        canvas.drawRoundRect(qrBgRect, 24f, 24f, paint)
        
        // QR Code
        val qrCode = generateQRCode(url, 360)
        canvas.drawBitmap(qrCode, 220f, 260f, null)
        
        // URL
        paint.color = Color.WHITE
        paint.textSize = 28f
        canvas.drawText(url, width / 2f, 720f, paint)
        
        // Instructions
        paint.textSize = 36f
        canvas.drawText("扫码或访问链接提问", width / 2f, 800f, paint)
        
        // Footer
        paint.textSize = 24f
        paint.alpha = 150
        canvas.drawText("Powered by AskBox", width / 2f, 960f, paint)
        
        return bitmap
    }
    
    /**
     * Save bitmap to cache and return content URI
     */
    fun saveBitmapToCache(context: Context, bitmap: Bitmap, fileName: String): Uri {
        val cachePath = File(context.cacheDir, "images")
        cachePath.mkdirs()
        
        val file = File(cachePath, fileName)
        FileOutputStream(file).use { out ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        }
        
        return FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
    }
    
    /**
     * Share text link
     */
    fun shareLink(context: Context, slug: String) {
        val url = getBoxUrl(slug)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, "向我匿名提问吧！\n$url")
            putExtra(Intent.EXTRA_SUBJECT, "AskBox 匿名提问箱")
        }
        context.startActivity(Intent.createChooser(intent, "分享到"))
    }
    
    /**
     * Share poster image
     */
    fun sharePoster(context: Context, slug: String) {
        val url = getBoxUrl(slug)
        val poster = generatePoster(slug, url)
        val uri = saveBitmapToCache(context, poster, "askbox-$slug-poster.png")
        
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, "向我匿名提问吧！\n$url")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "分享海报"))
    }
    
    /**
     * Share QR code image
     */
    fun shareQRCode(context: Context, slug: String) {
        val url = getBoxUrl(slug)
        val qrCode = generateQRCode(url, 512)
        val uri = saveBitmapToCache(context, qrCode, "askbox-$slug-qr.png")
        
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, "向我匿名提问吧！\n$url")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "分享二维码"))
    }
}
