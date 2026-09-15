package com.jose2929.micontrolfinanciero.mobile

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

// Fase 7: almacen persistente de fingerprints ya vistos, para que la
// deduplicacion (Fase 6) funcione entre invocaciones separadas del
// engine headless (cada una es un FlutterEngine nuevo, sin memoria
// compartida con la anterior), y tambien la use la pantalla de debug en
// foreground como la misma fuente de verdad.
object DedupPrefs {
    private const val PREFS_NAME = "mcf_dedup"
    private const val KEY_FINGERPRINTS = "fingerprints_json"
    private const val DEFAULT_WINDOW_MS = 60_000L

    // Devuelve true si el fingerprint ya se habia visto dentro de la
    // ventana de tiempo (es decir, es un duplicado). Siempre registra el
    // intento actual, y de paso poda entradas viejas.
    @Synchronized
    fun checkAndRecord(
        context: Context,
        fingerprint: String,
        windowMs: Long = DEFAULT_WINDOW_MS
    ): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val entries = decode(prefs.getString(KEY_FINGERPRINTS, null))
            .filterValues { now - it < windowMs }
            .toMutableMap()

        val isDuplicate = entries.containsKey(fingerprint)
        entries[fingerprint] = now

        prefs.edit().putString(KEY_FINGERPRINTS, encode(entries)).apply()
        return isDuplicate
    }

    private fun encode(entries: Map<String, Long>): String {
        val array = JSONArray()
        for ((fingerprint, seenAt) in entries) {
            val obj = JSONObject()
            obj.put("fingerprint", fingerprint)
            obj.put("seenAt", seenAt)
            array.put(obj)
        }
        return array.toString()
    }

    private fun decode(raw: String?): Map<String, Long> {
        if (raw == null) return emptyMap()
        val array = JSONArray(raw)
        val result = mutableMapOf<String, Long>()
        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            result[obj.getString("fingerprint")] = obj.getLong("seenAt")
        }
        return result
    }
}
