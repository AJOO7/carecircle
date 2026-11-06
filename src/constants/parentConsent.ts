export const PARENT_CONSENT_MESSAGES = {
  English: {
    reminders: 'Namaste {patient} ji, this is Care Circle. Your family would like to send you medicine reminders on WhatsApp. Reply YES to agree. You can reply STOP at any time.',
    sharing: "May we also share your replies with {members}? Reply YES or NO.",
  },
  // review with a native speaker before production use.
  Hindi: {
    reminders: 'नमस्ते {patient} जी, यह केयर सर्कल है। आपका परिवार आपको व्हाट्सऐप पर दवा के रिमाइंडर भेजना चाहता है। सहमति के लिए YES लिखकर जवाब दें। आप किसी भी समय STOP लिखकर जवाब दे सकती हैं।',
    sharing: 'क्या हम आपके जवाब {members} के साथ भी साझा कर सकते हैं? YES या NO लिखकर जवाब दें।',
  },
} as const

// Added to the reminders consent message when assistant reading is on, so the parent is told first. Hindi needs native-speaker review.
export const AI_DISCLOSURE = { English: 'If you reply in your own words, an automated assistant may read your message to help your family understand it. It only suggests; people decide.', Hindi: 'अगर आप अपने शब्दों में जवाब लिखें, तो एक स्वचालित सहायक आपका संदेश पढ़ सकता है ताकि परिवार उसे समझ सके। वह सिर्फ़ सुझाव देता है; फ़ैसला परिवार के लोग करते हैं।' } as const
  
export function parentConsentMessages(language: keyof typeof PARENT_CONSENT_MESSAGES, patientName: string, recipientNames: string[], aiReading = false) {
  const names = recipientNames.map(name => name.trim()).filter(Boolean)
  const recipients = names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')}${language === 'Hindi' ? ' और ' : ' and '}${names[names.length - 1]}`
  const template = aiReading ? { ...PARENT_CONSENT_MESSAGES[language], reminders: PARENT_CONSENT_MESSAGES[language].reminders + ' ' + AI_DISCLOSURE[language] } : PARENT_CONSENT_MESSAGES[language]
  return {
    reminders: template.reminders.replace('{patient}', patientName.trim() || (language === 'Hindi' ? 'आप' : 'there')),
    sharing: recipients ? template.sharing.replace('{members}', recipients) : (language === 'Hindi' ? 'अभी साझा करने के लिए कोई सक्रिय सदस्य नहीं है।' : 'There are no active circle members to share replies with yet.'),
  }
}
