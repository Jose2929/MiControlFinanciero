import 'package:flutter/services.dart';

import '../models/notification_event.dart';
export '../models/notification_event.dart';

class NotificationBridge {
  static const _eventChannel = EventChannel('mcf/notifications');
  static const _methodChannel = MethodChannel('mcf/notification_settings');

  Stream<NotificationEvent> get events => _eventChannel
      .receiveBroadcastStream()
      .map((event) => NotificationEvent.fromMap(event as Map));

  Future<void> openNotificationListenerSettings() {
    return _methodChannel.invokeMethod('openNotificationListenerSettings');
  }

  Future<bool> isNotificationAccessGranted() async {
    final granted = await _methodChannel.invokeMethod<bool>(
      'isNotificationAccessGranted',
    );
    return granted ?? false;
  }

  Future<void> postTestNotification() {
    return _methodChannel.invokeMethod('postTestNotification');
  }
}
