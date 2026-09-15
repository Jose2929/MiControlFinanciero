class NotificationEvent {
  final String packageName;
  final String appName;
  final String title;
  final String text;
  final int timestamp;

  NotificationEvent({
    required this.packageName,
    required this.appName,
    required this.title,
    required this.text,
    required this.timestamp,
  });

  factory NotificationEvent.fromMap(Map<dynamic, dynamic> map) {
    return NotificationEvent(
      packageName: map['packageName'] as String? ?? '',
      appName: map['appName'] as String? ?? '',
      title: map['title'] as String? ?? '',
      text: map['text'] as String? ?? '',
      timestamp: map['timestamp'] as int? ?? 0,
    );
  }
}
