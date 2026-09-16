package com.jose2929.micontrolfinanciero.mobile

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService

/**
 * Fase 15.2: recibe la frase reconocida por voz en la Tile del reloj
 * (`VoiceExpenseActivity`, módulo `:wear`) y dispara el mismo motor
 * headless que ya usan las notificaciones y "Aceptar rápido" (Fase 7 /
 * 15.1), con `"kind": "voice"`. Le contesta al reloj por el mismo canal
 * (`PATH_VOICE_EXPENSE_RESULT`) con un mensaje corto de éxito o error
 * para que la Activity del reloj lo muestre y se cierre sola.
 */
class VoiceMessageListener : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path != PATH_VOICE_EXPENSE) return

        val phrase = String(event.data)
        val sourceNodeId = event.sourceNodeId
        if (BuildConfig.DEBUG) {
            Log.d(TAG, "frase de voz recibida de $sourceNodeId")
        }

        // `onMessageReceived` corre en el HandlerThread propio de
        // WearableListenerService, no en el principal -- a diferencia de
        // NotificationListener.onNotificationPosted y
        // QuickConfirmReceiver.onReceive (ambos ya en el hilo principal).
        // BackgroundEngineManager.dispatch crea un FlutterEngine, que
        // exige correr en el hilo principal.
        val appContext = applicationContext
        Handler(Looper.getMainLooper()).post {
            BackgroundEngineManager.dispatch(
                appContext,
                mapOf("kind" to "voice", "phrase" to phrase)
            ) { resultMessage ->
                Wearable.getMessageClient(appContext)
                    .sendMessage(sourceNodeId, PATH_VOICE_EXPENSE_RESULT, resultMessage.toByteArray())
            }
        }
    }

    companion object {
        private const val TAG = "MCF_VoiceMessageListener"
        const val PATH_VOICE_EXPENSE = "/mcf/voice_expense"
        const val PATH_VOICE_EXPENSE_RESULT = "/mcf/voice_expense_result"
    }
}
