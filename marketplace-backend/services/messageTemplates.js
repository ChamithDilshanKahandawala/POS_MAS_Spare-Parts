// Email + SMS copy for every outgoing message, in en/si/ta. si/ta are drafts —
// have a native speaker review them before launch.
//
// group: which seller preference switches it off. 'security' and 'account'
//   can never be switched off.
// delivery: 'one' = SMS when the user has a phone, otherwise email (OTP);
//   'all' = email, plus SMS when `sms` copy exists and the user has a phone.
const LANGUAGES = ['en', 'si', 'ta'];

const TEMPLATES = {
  'otp.login': {
    group: 'security', delivery: 'one', redact: ['code'],
    en: { subject: 'Your Apexora login code', text: 'Your Apexora login code is {{code}}. It expires in 5 minutes. Never share this code with anyone.', sms: 'Apexora code: {{code}} (expires in 5 min). Never share it.' },
    si: { subject: 'ඔබේ Apexora පිවිසුම් කේතය', text: 'ඔබේ Apexora පිවිසුම් කේතය {{code}}. එය මිනිත්තු 5කින් කල් ඉකුත් වේ. මෙම කේතය කිසිවෙකු සමඟ බෙදා නොගන්න.', sms: 'Apexora කේතය: {{code}} (මිනිත්තු 5). කිසිවෙකුට නොදෙන්න.' },
    ta: { subject: 'உங்கள் Apexora உள்நுழைவு குறியீடு', text: 'உங்கள் Apexora உள்நுழைவு குறியீடு {{code}}. இது 5 நிமிடங்களில் காலாவதியாகும். இந்தக் குறியீட்டை யாருடனும் பகிர வேண்டாம்.', sms: 'Apexora குறியீடு: {{code}} (5 நிமி). யாருக்கும் சொல்ல வேண்டாம்.' },
  },
  'otp.stepup': {
    group: 'security', delivery: 'one', redact: ['code'],
    en: { subject: 'Confirm a sensitive action', text: 'Your Apexora confirmation code is {{code}}. It expires in 5 minutes. If you did not start this, change your password now.', sms: 'Apexora confirmation code: {{code}} (5 min). Not you? Change your password.' },
    si: { subject: 'සංවේදී ක්‍රියාවක් තහවුරු කරන්න', text: 'ඔබේ Apexora තහවුරු කිරීමේ කේතය {{code}}. එය මිනිත්තු 5කින් කල් ඉකුත් වේ. ඔබ මෙය ආරම්භ නොකළේ නම්, දැන්ම මුරපදය වෙනස් කරන්න.', sms: 'Apexora තහවුරු කේතය: {{code}} (මිනි 5). ඔබ නොවේ නම් මුරපදය වෙනස් කරන්න.' },
    ta: { subject: 'முக்கியமான செயலை உறுதிப்படுத்தவும்', text: 'உங்கள் Apexora உறுதிப்படுத்தல் குறியீடு {{code}}. இது 5 நிமிடங்களில் காலாவதியாகும். இதை நீங்கள் தொடங்கவில்லை என்றால், உடனே கடவுச்சொல்லை மாற்றவும்.', sms: 'Apexora உறுதி குறியீடு: {{code}} (5 நிமி). நீங்கள் இல்லையெனில் கடவுச்சொல்லை மாற்றவும்.' },
  },
  'password.reset': {
    group: 'security', delivery: 'all', redact: ['link'],
    en: { subject: 'Reset your Apexora password', text: 'Someone asked to reset your Apexora password. Open this link within 30 minutes to choose a new one:\n{{link}}\n\nIf this was not you, ignore this email.' },
    si: { subject: 'ඔබේ Apexora මුරපදය යළි සකසන්න', text: 'ඔබේ Apexora මුරපදය යළි සැකසීමට ඉල්ලීමක් ලැබුණි. නව මුරපදයක් තෝරා ගැනීමට මිනිත්තු 30ක් ඇතුළත මෙම සබැඳිය විවෘත කරන්න:\n{{link}}\n\nමෙය ඔබ නොවේ නම්, මෙම ඊමේලය නොසලකා හරින්න.' },
    ta: { subject: 'உங்கள் Apexora கடவுச்சொல்லை மீட்டமைக்கவும்', text: 'உங்கள் Apexora கடவுச்சொல்லை மீட்டமைக்க ஒரு கோரிக்கை வந்தது. புதிய கடவுச்சொல்லைத் தேர்வுசெய்ய 30 நிமிடங்களுக்குள் இந்த இணைப்பைத் திறக்கவும்:\n{{link}}\n\nஇது நீங்கள் இல்லையென்றால், இந்த மின்னஞ்சலைப் புறக்கணிக்கவும்.' },
  },

  'security.phone_changed': {
    group: 'security', delivery: 'all',
    en: { subject: 'Your Apexora phone number was changed', text: 'The mobile number on your Apexora account is now {{phone}}. Login codes will go there. If you did not make this change, reset your password now and contact us.' },
    si: { subject: 'ඔබේ Apexora දුරකථන අංකය වෙනස් කරන ලදී', text: 'ඔබේ Apexora ගිණුමේ ජංගම අංකය දැන් {{phone}}. පිවිසුම් කේත එම අංකයට යවනු ලැබේ. ඔබ මෙම වෙනස සිදු නොකළේ නම්, දැන්ම මුරපදය යළි සකසා අප අමතන්න.' },
    ta: { subject: 'உங்கள் Apexora தொலைபேசி எண் மாற்றப்பட்டது', text: 'உங்கள் Apexora கணக்கின் கைபேசி எண் இப்போது {{phone}}. உள்நுழைவு குறியீடுகள் அங்கு அனுப்பப்படும். இந்த மாற்றத்தை நீங்கள் செய்யவில்லை என்றால், உடனே கடவுச்சொல்லை மீட்டமைத்து எங்களைத் தொடர்புகொள்ளவும்.' },
  },

  'order.placed': {
    group: 'orders', delivery: 'all',
    en: { subject: 'Order {{orderNumber}} placed', text: 'Thank you! Your order {{orderNumber}} for Rs. {{amount}} (cash on delivery) has been placed. Each seller will confirm and ship their part. Track it any time under My Orders.', sms: 'Apexora: order {{orderNumber}} placed, Rs. {{amount}} COD. We will text you when it ships.' },
    si: { subject: 'ඇණවුම {{orderNumber}} තබන ලදී', text: 'ස්තූතියි! රු. {{amount}} (භාණ්ඩ ලැබුණු පසු ගෙවීම) වටිනා ඔබේ ඇණවුම {{orderNumber}} තබන ලදී. සෑම විකුණුම්කරුවෙකුම තම කොටස තහවුරු කර යවනු ඇත. "මගේ ඇණවුම්" යටතේ ඕනෑම වේලාවක බලන්න.', sms: 'Apexora: ඇණවුම {{orderNumber}} තබන ලදී, රු. {{amount}} COD. යවන විට අපි දන්වන්නෙමු.' },
    ta: { subject: 'ஆர்டர் {{orderNumber}} வைக்கப்பட்டது', text: 'நன்றி! ரூ. {{amount}} (டெலிவரியின் போது பணம்) மதிப்புள்ள உங்கள் ஆர்டர் {{orderNumber}} வைக்கப்பட்டது. ஒவ்வொரு விற்பனையாளரும் தங்கள் பகுதியை உறுதிப்படுத்தி அனுப்புவார்கள். "எனது ஆர்டர்கள்" பகுதியில் எப்போது வேண்டுமானாலும் பார்க்கலாம்.', sms: 'Apexora: ஆர்டர் {{orderNumber}} வைக்கப்பட்டது, ரூ. {{amount}} COD. அனுப்பும்போது தெரிவிப்போம்.' },
  },
  'order.new': {
    group: 'orders', delivery: 'all',
    en: { subject: 'New order {{orderNumber}}', text: 'You have a new order {{orderNumber}}: {{itemCount}} item(s), COD Rs. {{amount}}. Please confirm it in the Seller Center before it auto-cancels.', sms: 'Apexora: new order {{orderNumber}}, {{itemCount}} item(s), Rs. {{amount}} COD. Confirm it in the Seller Center.' },
    si: { subject: 'නව ඇණවුම {{orderNumber}}', text: 'ඔබට නව ඇණවුමක් ලැබී ඇත {{orderNumber}}: අයිතම {{itemCount}}, COD රු. {{amount}}. ස්වයංක්‍රීයව අවලංගු වීමට පෙර Seller Center හි එය තහවුරු කරන්න.', sms: 'Apexora: නව ඇණවුම {{orderNumber}}, අයිතම {{itemCount}}, රු. {{amount}} COD. Seller Center හි තහවුරු කරන්න.' },
    ta: { subject: 'புதிய ஆர்டர் {{orderNumber}}', text: 'உங்களுக்கு புதிய ஆர்டர் {{orderNumber}} வந்துள்ளது: {{itemCount}} பொருள்(கள்), COD ரூ. {{amount}}. தானாக ரத்தாவதற்கு முன் Seller Center இல் உறுதிப்படுத்தவும்.', sms: 'Apexora: புதிய ஆர்டர் {{orderNumber}}, {{itemCount}} பொருள், ரூ. {{amount}} COD. Seller Center இல் உறுதிப்படுத்தவும்.' },
  },
  'order.shipped': {
    group: 'orders', delivery: 'all',
    en: { subject: 'Order {{orderNumber}} has shipped', text: 'Good news — your parcel {{orderNumber}} is on its way with {{courier}}. Tracking number: {{trackingNumber}}. Please keep Rs. {{amount}} ready for cash on delivery.', sms: 'Apexora: {{orderNumber}} shipped via {{courier}}, tracking {{trackingNumber}}. Keep Rs. {{amount}} ready.' },
    si: { subject: 'ඇණවුම {{orderNumber}} යවා ඇත', text: 'සුබ පුවතක් — ඔබේ පාර්සලය {{orderNumber}} {{courier}} මගින් ඔබ වෙත පැමිණෙමින් පවතී. ලුහුබැඳීමේ අංකය: {{trackingNumber}}. භාණ්ඩ ලැබෙන විට ගෙවීමට රු. {{amount}} සූදානම් කර තබන්න.', sms: 'Apexora: {{orderNumber}} {{courier}} මගින් යවා ඇත, අංකය {{trackingNumber}}. රු. {{amount}} සූදානම් කරන්න.' },
    ta: { subject: 'ஆர்டர் {{orderNumber}} அனுப்பப்பட்டது', text: 'நல்ல செய்தி — உங்கள் பார்சல் {{orderNumber}} {{courier}} மூலம் வந்துகொண்டிருக்கிறது. கண்காணிப்பு எண்: {{trackingNumber}}. டெலிவரியின் போது செலுத்த ரூ. {{amount}} தயாராக வைத்திருக்கவும்.', sms: 'Apexora: {{orderNumber}} {{courier}} மூலம் அனுப்பப்பட்டது, எண் {{trackingNumber}}. ரூ. {{amount}} தயார் செய்யவும்.' },
  },
  'order.delivered': {
    group: 'orders', delivery: 'all',
    en: { subject: 'Order {{orderNumber}} delivered', text: 'Your parcel {{orderNumber}} was delivered. If anything is wrong, you can report a problem from My Orders within the return window.', sms: 'Apexora: {{orderNumber}} delivered. Problem? Report it from My Orders.' },
    si: { subject: 'ඇණවුම {{orderNumber}} භාර දෙන ලදී', text: 'ඔබේ පාර්සලය {{orderNumber}} භාර දෙන ලදී. කිසියම් ගැටලුවක් ඇත්නම්, ආපසු යැවීමේ කාලය තුළ "මගේ ඇණවුම්" වෙතින් එය දන්වන්න.', sms: 'Apexora: {{orderNumber}} භාර දෙන ලදී. ගැටලුවක්? "මගේ ඇණවුම්" වෙතින් දන්වන්න.' },
    ta: { subject: 'ஆர்டர் {{orderNumber}} டெலிவரி செய்யப்பட்டது', text: 'உங்கள் பார்சல் {{orderNumber}} டெலிவரி செய்யப்பட்டது. ஏதேனும் பிரச்சினை இருந்தால், திருப்பி அனுப்பும் காலத்திற்குள் "எனது ஆர்டர்கள்" இலிருந்து தெரிவிக்கவும்.', sms: 'Apexora: {{orderNumber}} டெலிவரி ஆனது. பிரச்சினையா? "எனது ஆர்டர்கள்" இல் தெரிவிக்கவும்.' },
  },

  'payout.paid': {
    group: 'payouts', delivery: 'all',
    en: { subject: 'Payout of Rs. {{amount}} sent', text: 'We have sent your payout of Rs. {{amount}}. Bank reference: {{reference}}. The statement is in Finance in the Seller Center.', sms: 'Apexora: payout Rs. {{amount}} sent, ref {{reference}}.' },
    si: { subject: 'රු. {{amount}} ගෙවීම යවන ලදී', text: 'ඔබේ රු. {{amount}} ගෙවීම අපි යවා ඇත. බැංකු යොමුව: {{reference}}. ප්‍රකාශය Seller Center හි Finance යටතේ ඇත.', sms: 'Apexora: ගෙවීම රු. {{amount}} යවන ලදී, යොමුව {{reference}}.' },
    ta: { subject: 'ரூ. {{amount}} பணம் அனுப்பப்பட்டது', text: 'உங்கள் ரூ. {{amount}} பணத்தை அனுப்பியுள்ளோம். வங்கிக் குறிப்பு: {{reference}}. அறிக்கை Seller Center இல் Finance பகுதியில் உள்ளது.', sms: 'Apexora: ரூ. {{amount}} அனுப்பப்பட்டது, குறிப்பு {{reference}}.' },
  },
  'payout.failed': {
    group: 'payouts', delivery: 'all',
    en: { subject: 'A payout of Rs. {{amount}} failed', text: 'Your payout of Rs. {{amount}} could not be completed: {{reason}}. The amount is back in your balance and will go out with the next payout. Please check your bank details in the Seller Center.' },
    si: { subject: 'රු. {{amount}} ගෙවීමක් අසාර්ථක විය', text: 'ඔබේ රු. {{amount}} ගෙවීම සම්පූර්ණ කළ නොහැකි විය: {{reason}}. මුදල නැවත ඔබේ ශේෂයට එක් වී ඇති අතර ඊළඟ ගෙවීම සමඟ යවනු ලැබේ. Seller Center හි ඔබේ බැංකු විස්තර පරීක්ෂා කරන්න.' },
    ta: { subject: 'ரூ. {{amount}} பணம் அனுப்புதல் தோல்வியடைந்தது', text: 'உங்கள் ரூ. {{amount}} பணம் அனுப்புதலை முடிக்க முடியவில்லை: {{reason}}. தொகை உங்கள் இருப்பில் திரும்பச் சேர்க்கப்பட்டு அடுத்த முறை அனுப்பப்படும். Seller Center இல் உங்கள் வங்கி விவரங்களைச் சரிபார்க்கவும்.' },
  },

  'return.requested': {
    group: 'returns', delivery: 'all',
    en: { subject: 'Return request {{requestNumber}} for {{orderNumber}}', text: 'A customer asked to return items from {{orderNumber}} (request {{requestNumber}}). Please accept or reject it by {{deadline}} — after that it goes to the Apexora team.', sms: 'Apexora: return {{requestNumber}} for {{orderNumber}}. Respond by {{deadline}}.' },
    si: { subject: '{{orderNumber}} සඳහා ආපසු යැවීමේ ඉල්ලීම {{requestNumber}}', text: 'පාරිභෝගිකයෙකු {{orderNumber}} හි අයිතම ආපසු යැවීමට ඉල්ලා ඇත (ඉල්ලීම {{requestNumber}}). {{deadline}} ට පෙර එය පිළිගන්න හෝ ප්‍රතික්ෂේප කරන්න — ඉන් පසු එය Apexora කණ්ඩායමට යයි.', sms: 'Apexora: {{orderNumber}} සඳහා ආපසු යැවීම {{requestNumber}}. {{deadline}} ට පෙර පිළිතුරු දෙන්න.' },
    ta: { subject: '{{orderNumber}} க்கான திருப்பக் கோரிக்கை {{requestNumber}}', text: 'ஒரு வாடிக்கையாளர் {{orderNumber}} இலிருந்து பொருட்களைத் திருப்பி அனுப்பக் கேட்டுள்ளார் (கோரிக்கை {{requestNumber}}). {{deadline}} க்குள் ஏற்கவும் அல்லது நிராகரிக்கவும் — அதன் பிறகு Apexora குழுவிடம் செல்லும்.', sms: 'Apexora: {{orderNumber}} க்கு திருப்பம் {{requestNumber}}. {{deadline}} க்குள் பதிலளிக்கவும்.' },
  },
  'return.decided': {
    group: 'returns', delivery: 'all',
    // vars.decision ('refund' | 'dismissed') picks the localized {{outcome}}.
    outcomes: {
      en: { refund: 'approved — the item comes back and a refund follows', dismissed: 'declined — the return is closed with no refund' },
      si: { refund: 'අනුමතයි — අයිතමය ආපසු එවූ පසු මුදල් ආපසු ගෙවනු ලැබේ', dismissed: 'ප්‍රතික්ෂේපිතයි — මුදල් ආපසු නොගෙවා ආපසු යැවීම වසා ඇත' },
      ta: { refund: 'அங்கீகரிக்கப்பட்டது — பொருள் திரும்ப வந்ததும் பணம் திருப்பி அளிக்கப்படும்', dismissed: 'நிராகரிக்கப்பட்டது — பணத்திருப்பம் இல்லாமல் திருப்பம் மூடப்பட்டது' },
    },
    en: { subject: 'Decision on return {{requestNumber}}', text: 'The Apexora team reviewed return {{requestNumber}} for {{orderNumber}}: {{outcome}}.\n{{note}}' },
    si: { subject: 'ආපසු යැවීම {{requestNumber}} පිළිබඳ තීරණය', text: 'Apexora කණ්ඩායම {{orderNumber}} සඳහා ආපසු යැවීම {{requestNumber}} සමාලෝචනය කළේය: {{outcome}}.\n{{note}}' },
    ta: { subject: 'திருப்பம் {{requestNumber}} பற்றிய முடிவு', text: 'Apexora குழு {{orderNumber}} க்கான திருப்பம் {{requestNumber}} ஐ மதிப்பாய்வு செய்தது: {{outcome}}.\n{{note}}' },
  },
  'return.refunded': {
    group: 'returns', delivery: 'all',
    en: { subject: 'Refund for return {{requestNumber}}', text: 'A refund of Rs. {{amount}} was recorded for return {{requestNumber}} ({{orderNumber}}). Reference: {{reference}}.', sms: 'Apexora: refund Rs. {{amount}} for {{requestNumber}}, ref {{reference}}.' },
    si: { subject: 'ආපසු යැවීම {{requestNumber}} සඳහා මුදල් ආපසු ගෙවීම', text: 'ආපසු යැවීම {{requestNumber}} ({{orderNumber}}) සඳහා රු. {{amount}} ආපසු ගෙවීමක් සටහන් කරන ලදී. යොමුව: {{reference}}.', sms: 'Apexora: {{requestNumber}} සඳහා රු. {{amount}} ආපසු ගෙවන ලදී, යොමුව {{reference}}.' },
    ta: { subject: 'திருப்பம் {{requestNumber}} க்கான பணத்திருப்பம்', text: 'திருப்பம் {{requestNumber}} ({{orderNumber}}) க்கு ரூ. {{amount}} பணத்திருப்பம் பதிவு செய்யப்பட்டது. குறிப்பு: {{reference}}.', sms: 'Apexora: {{requestNumber}} க்கு ரூ. {{amount}} திருப்பி அளிக்கப்பட்டது, குறிப்பு {{reference}}.' },
  },

  'invite.seller_staff': {
    group: 'account', delivery: 'all', redact: ['link'],
    en: { subject: 'You are invited to {{storeName}} on Apexora', text: 'You have been invited to help run {{storeName}} on Apexora. Accept the invite here:\n{{link}}' },
    si: { subject: 'Apexora හි {{storeName}} වෙත ඔබට ආරාධනා කර ඇත', text: 'Apexora හි {{storeName}} පවත්වාගෙන යාමට උදව් කිරීමට ඔබට ආරාධනා කර ඇත. ආරාධනාව මෙතැනින් පිළිගන්න:\n{{link}}' },
    ta: { subject: 'Apexora இல் {{storeName}} க்கு அழைக்கப்பட்டுள்ளீர்கள்', text: 'Apexora இல் {{storeName}} ஐ நடத்த உதவ நீங்கள் அழைக்கப்பட்டுள்ளீர்கள். அழைப்பை இங்கே ஏற்கவும்:\n{{link}}' },
  },
  'invite.platform_staff': {
    group: 'account', delivery: 'all', redact: ['link'],
    en: { subject: 'You are invited to the Apexora team', text: 'You have been invited to join the Apexora platform team. Accept the invite here:\n{{link}}' },
    si: { subject: 'ඔබට Apexora කණ්ඩායමට ආරාධනා කර ඇත', text: 'Apexora වේදිකා කණ්ඩායමට එක්වීමට ඔබට ආරාධනා කර ඇත. ආරාධනාව මෙතැනින් පිළිගන්න:\n{{link}}' },
    ta: { subject: 'Apexora குழுவில் சேர அழைக்கப்பட்டுள்ளீர்கள்', text: 'Apexora தளக் குழுவில் சேர நீங்கள் அழைக்கப்பட்டுள்ளீர்கள். அழைப்பை இங்கே ஏற்கவும்:\n{{link}}' },
  },
  'application.approved': {
    group: 'account', delivery: 'all', redact: ['link'],
    en: { subject: 'Your Apexora seller application was approved', text: 'Welcome to Apexora! Your application for {{storeName}} was approved. Set up your account here:\n{{link}}' },
    si: { subject: 'ඔබේ Apexora විකුණුම්කරු අයදුම්පත අනුමත විය', text: 'Apexora වෙත සාදරයෙන් පිළිගනිමු! {{storeName}} සඳහා ඔබේ අයදුම්පත අනුමත විය. ඔබේ ගිණුම මෙතැනින් සකසන්න:\n{{link}}' },
    ta: { subject: 'உங்கள் Apexora விற்பனையாளர் விண்ணப்பம் அங்கீகரிக்கப்பட்டது', text: 'Apexora க்கு வரவேற்கிறோம்! {{storeName}} க்கான உங்கள் விண்ணப்பம் அங்கீகரிக்கப்பட்டது. உங்கள் கணக்கை இங்கே அமைக்கவும்:\n{{link}}' },
  },
  'application.info_requested': {
    group: 'account', delivery: 'all',
    en: { subject: 'More information needed for your Apexora application', text: 'We need a little more information about your application for {{storeName}}:\n\n{{message}}\n\nPlease reply with the details.' },
    si: { subject: 'ඔබේ Apexora අයදුම්පත සඳහා තවත් තොරතුරු අවශ්‍යයි', text: '{{storeName}} සඳහා ඔබේ අයදුම්පත ගැන අපට තව ටිකක් තොරතුරු අවශ්‍යයි:\n\n{{message}}\n\nකරුණාකර විස්තර සමඟ පිළිතුරු දෙන්න.' },
    ta: { subject: 'உங்கள் Apexora விண்ணப்பத்திற்கு கூடுதல் தகவல் தேவை', text: '{{storeName}} க்கான உங்கள் விண்ணப்பம் பற்றி எங்களுக்கு இன்னும் சில தகவல்கள் தேவை:\n\n{{message}}\n\nவிவரங்களுடன் பதிலளிக்கவும்.' },
  },
  'application.rejected': {
    group: 'account', delivery: 'all',
    en: { subject: 'Your Apexora seller application', text: 'Thank you for applying to sell {{storeName}} on Apexora. We could not approve the application this time:\n\n{{reason}}' },
    si: { subject: 'ඔබේ Apexora විකුණුම්කරු අයදුම්පත', text: 'Apexora හි {{storeName}} විකිණීමට අයදුම් කිරීම ගැන ස්තූතියි. මෙවර අපට අයදුම්පත අනුමත කළ නොහැකි විය:\n\n{{reason}}' },
    ta: { subject: 'உங்கள் Apexora விற்பனையாளர் விண்ணப்பம்', text: 'Apexora இல் {{storeName}} ஐ விற்க விண்ணப்பித்ததற்கு நன்றி. இந்த முறை விண்ணப்பத்தை அங்கீகரிக்க முடியவில்லை:\n\n{{reason}}' },
  },
};

const PREFERENCE_GROUPS = ['orders', 'returns', 'payouts'];

function fill(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] === undefined || vars[key] === null ? '' : String(vars[key]))).trim();
}

// Returns { subject, text, sms } for one language, falling back to English
// only if a language is somehow missing (tests assert none are).
function renderTemplate(key, language, vars = {}) {
  const template = TEMPLATES[key];
  if (!template) throw new Error(`Unknown message template: ${key}`);
  const copy = template[language] || template.en;
  if (template.outcomes && vars.decision) {
    vars = { ...vars, outcome: (template.outcomes[language] || template.outcomes.en)[vars.decision] };
  }
  return {
    subject: fill(copy.subject, vars),
    text: fill(copy.text, vars),
    sms: copy.sms ? fill(copy.sms, vars) : null,
  };
}

module.exports = { TEMPLATES, LANGUAGES, PREFERENCE_GROUPS, renderTemplate };
