package com.jose2929.micontrolfinanciero.mobile

import android.util.Log
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

/**
 * Fase 15.0(6): spike de transporte. Solo confirma que un mensaje enviado
 * desde el modulo `:wear` por el Wearable Data Layer llega al telefono,
 * app cerrada o no. Sin logica real todavia — eso lo agrega 15.2
 * (`"kind": "voice"` hacia el motor headless).
 */
class WearMessageListener : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path == PATH_SPIKE_TEST) {
            val payload = String(event.data)
            if (BuildConfig.DEBUG) {
                Log.d("MCF_WearMessage", "recibido de ${event.sourceNodeId}: $payload")
            }
        }
    }

    companion object {
        const val PATH_SPIKE_TEST = "/mcf/spike_test"
    }
}
