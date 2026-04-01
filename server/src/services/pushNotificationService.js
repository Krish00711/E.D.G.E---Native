import Expo from 'expo-server-sdk'

const expo = new Expo()

export async function sendPushNotification(expoPushToken, title, body, data = {}) {
  try {
    if (!Expo.isExpoPushToken(expoPushToken)) {
      console.warn(`[Push] Invalid Expo push token: ${expoPushToken}`)
      return null
    }

    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      badge: 1
    }

    const tickets = await expo.sendPushNotificationsAsync([message])
    const ticket = tickets[0] || null

    if (ticket && ticket.status === 'ok') {
      console.log(`[Push] Notification sent successfully to token: ${expoPushToken}`)
    } else {
      console.error('[Push] Notification send returned non-ok ticket:', ticket)
    }

    return ticket
  } catch (error) {
    console.error('[Push] Failed to send push notification:', error)
    return null
  }
}

export async function sendBulkPushNotifications(notifications) {
  try {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return { sent: 0, failed: 0 }
    }

    const validMessages = []
    let invalidCount = 0

    for (const item of notifications) {
      const token = item?.token
      if (!Expo.isExpoPushToken(token)) {
        console.warn(`[Push] Skipping invalid Expo push token: ${token}`)
        invalidCount += 1
        continue
      }

      validMessages.push({
        to: token,
        sound: 'default',
        title: item?.title || '',
        body: item?.body || '',
        data: item?.data || {},
        badge: 1
      })
    }

    if (validMessages.length === 0) {
      return { sent: 0, failed: invalidCount }
    }

    const chunks = expo.chunkPushNotifications(validMessages)
    let sent = 0
    let failed = invalidCount

    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk)
        for (const ticket of tickets) {
          if (ticket?.status === 'ok') {
            sent += 1
          } else {
            failed += 1
            console.error('[Push] Bulk notification ticket error:', ticket)
          }
        }
      } catch (chunkError) {
        failed += chunk.length
        console.error('[Push] Failed to send notification chunk:', chunkError)
      }
    }

    console.log(`[Push] Bulk send complete. Sent: ${sent}, Failed: ${failed}`)
    return { sent, failed }
  } catch (error) {
    console.error('[Push] Failed to send bulk notifications:', error)
    const total = Array.isArray(notifications) ? notifications.length : 0
    return { sent: 0, failed: total }
  }
}

export async function sendBurnoutAlert(expoPushToken, riskLevel, riskScore) {
  try {
    const bodyByRiskLevel = {
      high: 'Your burnout risk is HIGH. Please take action now.',
      moderate: 'Your burnout risk is MODERATE. Consider taking a break.',
      low: 'Your burnout risk is LOW. Keep it up!'
    }

    const normalizedRiskLevel = String(riskLevel || '').toLowerCase()
    const body = bodyByRiskLevel[normalizedRiskLevel] || bodyByRiskLevel.low

    return await sendPushNotification(
      expoPushToken,
      '⚠️ Burnout Risk Alert',
      body,
      {
        type: 'burnout_alert',
        riskLevel,
        riskScore
      }
    )
  } catch (error) {
    console.error('[Push] Failed to send burnout alert:', error)
    return null
  }
}
