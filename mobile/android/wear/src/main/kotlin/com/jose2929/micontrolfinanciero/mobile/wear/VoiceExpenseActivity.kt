package com.jose2929.micontrolfinanciero.mobile.wear

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognizerIntent
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import java.util.Locale

/**
 * Fase 15.2: se abre desde la Tile "Gasto por voz" (o directo desde el
 * launcher del reloj) — dispara el picker de voz de inmediato, manda la
 * frase reconocida al teléfono por el Wearable Data Layer, y muestra la
 * respuesta (éxito o error) antes de cerrarse sola. El teléfono hace todo
 * el trabajo real (parseo, cuenta, categoría, escritura a Firebase) —
 * "reloj delgado, teléfono gordo" (ver plan de Fase 15).
 */
class VoiceExpenseActivity : ComponentActivity() {

    private val mainHandler = Handler(Looper.getMainLooper())
    private var resultListener: MessageClient.OnMessageReceivedListener? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            var status by remember { mutableStateOf("Escuchando...") }

            val speechLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.StartActivityForResult(),
            ) { result ->
                val text = if (result.resultCode == Activity.RESULT_OK) {
                    result.data
                        ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                        ?.firstOrNull()
                } else {
                    null
                }
                if (text == null) {
                    status = "No se escuchó nada."
                    finishAfterDelay()
                } else {
                    status = "Enviando..."
                    sendPhrase(text) { message ->
                        status = message
                        finishAfterDelay()
                    }
                }
            }

            val micPermissionLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.RequestPermission(),
            ) { granted ->
                if (granted) {
                    speechLauncher.launch(buildSpeechIntent())
                } else {
                    status = "Permiso de micrófono denegado."
                    finishAfterDelay()
                }
            }

            LaunchedEffect(Unit) {
                val hasPermission = ContextCompat.checkSelfPermission(
                    this@VoiceExpenseActivity,
                    Manifest.permission.RECORD_AUDIO,
                ) == PackageManager.PERMISSION_GRANTED
                if (hasPermission) {
                    speechLauncher.launch(buildSpeechIntent())
                } else {
                    micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
            }

            MaterialTheme {
                ScalingLazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                    item { Text("Gasto por voz") }
                    item { Text(status) }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        resultListener?.let { Wearable.getMessageClient(this).removeListener(it) }
    }

    private fun sendPhrase(phrase: String, onResult: (String) -> Unit) {
        val messageClient = Wearable.getMessageClient(this)
        var answered = false

        val listener = MessageClient.OnMessageReceivedListener { event: MessageEvent ->
            if (event.path == PATH_VOICE_EXPENSE_RESULT && !answered) {
                answered = true
                mainHandler.post { onResult(String(event.data)) }
            }
        }
        resultListener = listener
        messageClient.addListener(listener)

        mainHandler.postDelayed({
            if (!answered) {
                answered = true
                onResult("Sin respuesta del teléfono.")
            }
        }, RESPONSE_TIMEOUT_MS)

        Wearable.getNodeClient(this).connectedNodes
            .addOnSuccessListener { nodes ->
                val node = nodes.firstOrNull()
                if (node == null) {
                    if (!answered) {
                        answered = true
                        onResult("El reloj no está conectado al teléfono.")
                    }
                    return@addOnSuccessListener
                }
                messageClient.sendMessage(node.id, PATH_VOICE_EXPENSE, phrase.toByteArray())
            }
            .addOnFailureListener {
                if (!answered) {
                    answered = true
                    onResult("No se pudo enviar: ${it.message}")
                }
            }
    }

    private fun finishAfterDelay() {
        mainHandler.postDelayed({ finish() }, DISPLAY_RESULT_MS)
    }

    private fun buildSpeechIntent(): Intent =
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
            )
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale("es", "MX").toString())
        }

    companion object {
        private const val PATH_VOICE_EXPENSE = "/mcf/voice_expense"
        private const val PATH_VOICE_EXPENSE_RESULT = "/mcf/voice_expense_result"
        private const val RESPONSE_TIMEOUT_MS = 8_000L
        private const val DISPLAY_RESULT_MS = 2_500L
    }
}
