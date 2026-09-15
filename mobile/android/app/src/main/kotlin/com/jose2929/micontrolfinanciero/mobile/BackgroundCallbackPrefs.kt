package com.jose2929.micontrolfinanciero.mobile

import android.content.Context

// Fase 7: guarda el callback handle (PluginUtilities.getCallbackHandle)
// del entrypoint Dart de segundo plano, para poder arrancar el engine
// headless aunque la app haya sido cerrada por completo y solo quede
// vivo NotificationListenerService.
object BackgroundCallbackPrefs {
    private const val PREFS_NAME = "mcf_background_callback"
    private const val KEY_HANDLE = "callback_handle"

    fun save(context: Context, handle: Long) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_HANDLE, handle)
            .apply()
    }

    fun get(context: Context): Long? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val handle = prefs.getLong(KEY_HANDLE, -1L)
        return if (handle == -1L) null else handle
    }
}
