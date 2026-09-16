package com.jose2929.micontrolfinanciero.mobile.wear

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognizerIntent
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.google.android.gms.wearable.Wearable
import java.util.Locale

// Fase 15.0(5) — spike: valida que el picker de voz estandar de Android
// (sin libreria de terceros) funcione bien en este Galaxy Watch6 y deja
// ver el formato real del texto reconocido (digitos vs. letras para los
// montos) antes de cerrar el regex de VoiceParser en 15.2.
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            var recognized by remember { mutableStateOf("(nada todavia)") }

            val speechLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.StartActivityForResult(),
            ) { result ->
                if (result.resultCode == Activity.RESULT_OK) {
                    val texts =
                        result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                    recognized = texts?.firstOrNull() ?: "(vacio)"
                } else {
                    recognized = "(cancelado, resultCode=${result.resultCode})"
                }
            }

            val micPermissionLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.RequestPermission(),
            ) { granted ->
                if (granted) {
                    speechLauncher.launch(buildSpeechIntent())
                } else {
                    recognized = "(permiso de microfono denegado)"
                }
            }

            MaterialTheme {
                ScalingLazyColumn(modifier = Modifier.fillMaxSize()) {
                    item { Text("MiControlFinanciero") }
                    item {
                        Chip(
                            onClick = {
                                val hasPermission = ContextCompat.checkSelfPermission(
                                    this@MainActivity,
                                    Manifest.permission.RECORD_AUDIO,
                                ) == PackageManager.PERMISSION_GRANTED
                                if (hasPermission) {
                                    speechLauncher.launch(buildSpeechIntent())
                                } else {
                                    micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                }
                            },
                            label = { Text("Hablar") },
                            colors = ChipDefaults.primaryChipColors(),
                        )
                    }
                    item { Text(recognized) }
                    item {
                        Chip(
                            onClick = { sendSpikeMessage { recognized = it } },
                            label = { Text("Enviar prueba") },
                            colors = ChipDefaults.secondaryChipColors(),
                        )
                    }
                }
            }
        }
    }

    // Fase 15.0(6): aisla el transporte reloj -> telefono (Wearable Data
    // Layer) de todo lo demas — string fijo, sin voz, sin Firebase.
    private fun sendSpikeMessage(onStatus: (String) -> Unit) {
        val messageClient = Wearable.getMessageClient(this)
        Wearable.getNodeClient(this).connectedNodes
            .addOnSuccessListener { nodes ->
                if (nodes.isEmpty()) {
                    onStatus("(sin nodos conectados)")
                    return@addOnSuccessListener
                }
                nodes.forEach { node ->
                    messageClient
                        .sendMessage(node.id, "/mcf/spike_test", "hola_desde_el_reloj".toByteArray())
                        .addOnSuccessListener { onStatus("enviado a ${node.displayName}") }
                        .addOnFailureListener { e -> onStatus("error enviando: ${e.message}") }
                }
            }
            .addOnFailureListener { e -> onStatus("error nodos: ${e.message}") }
    }

    private fun buildSpeechIntent(): Intent =
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
            )
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale("es", "MX").toString())
        }
}
