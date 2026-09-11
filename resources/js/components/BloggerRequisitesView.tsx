/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Integration, BloggerRequisites } from '../data/mockData';
import { Language, translations } from '../translations';
import { 
  ShieldCheck, 
  Lock, 
  FileText, 
  CreditCard, 
  UserCheck, 
  CheckCircle, 
  CheckCircle2,
  Radio, 
  Eye, 
  Globe,
  Sparkles,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  X,
  ZoomIn,
  FileCheck,
  ArrowLeft
} from 'lucide-react';

import idCardSampleFront from '../../images/id_card_sample_front.png';
import idCardSampleBack from '../../images/id_card_sample_back.png';
import idCardSampleFull from '../../images/id_card_sample_full.png';

const compressImage = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = () => {
        resolve(event.target?.result as string);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface BloggerRequisitesViewProps {
  integrationToken?: string;
  integrations?: Integration[];
  onSubmitRequisites?: (integrationId: string, requisites: Omit<BloggerRequisites, 'id' | 'submittedAt' | 'status'>) => Promise<void> | void;
  onBack?: () => void;
  lang?: Language;
  setLang?: (lang: Language) => void;
}

const requisitesTranslations = {
  ru: {
    pageTitle: 'Форма реквизитов и договора',
    securityGuarantee: 'Ваши данные в полной безопасности',
    securityText: 'Реквизиты используются только для перевода оплаты за рекламу. Мы гарантируем 100% конфиденциальность: данные надёжно защищены и никогда не передаются посторонним лицам.',
    submittedTitle: 'Данные успешно отправлены!',
    submittedText: 'Ваши реквизиты приняты в работу. Наш финансовый отдел проверит данные и подготовит выплату.',
    editDataBtn: 'Редактировать данные',

    // Section 1: Cooperation format
    sectionFormat: '1. Способ оформления и выплаты *',
    formatCardTitle: 'Прямой перевод на карту',
    formatCardDesc: 'UzCard / HUMO',
    formatContractTitle: 'Официальный договор',
    formatContractDesc: 'Электронный договор оказания услуг с физическим лицом',

    // Section 2: Direct Card Payout vs Official Contract
    sectionCardPayout: '2. Реквизиты для перевода на карту',
    sectionPassportRequired: '2. Паспортные данные и ПИНФЛ *',
    fullNameLabel: 'Полное ФИО (как в паспорте) *',
    fullNamePlaceholder: 'Алиев Бахтиёр Каримович',
    pinflLabelRequired: 'ПИНФЛ или ИНН (14 цифр) *',
    pinflPlaceholder: '30102938475839',
    passportLabelRequired: 'Серия и номер паспорта / ID *',
    passportPlaceholder: 'AD 1234567',
    issuedByLabel: 'Кем выдан (орган выдачи)',
    issuedByPlaceholder: 'РОВД Мирзо-Улугбекского р-на',
    addressLabel: 'Адрес постоянной регистрации',
    addressPlaceholder: 'г. Ташкент, ул. Навои, 15',

    // Passport scans upload (Two sides)
    passportScansTitle: 'Копия паспорта / ID-карты (обе стороны)',
    passportScansSubtitle: 'Прикрепите фото или скан паспорта / ID с двух сторон для оформления договора',
    passportFrontTitle: 'Лицевая сторона',
    passportFrontHint: 'Фото и личные данные',
    passportBackTitle: 'Обратная сторона',
    passportBackHint: 'Адрес прописки / штамп',
    uploadScanBtn: 'Выбрать фото',
    changeScanBtn: 'Заменить',
    removeScanBtn: 'Удалить',
    previewScanBtn: 'Просмотр',
    scanUploadedText: 'Загружено',
    clickOrDropText: 'Нажмите или перетащите фото',
    supportedFormatsText: 'JPG, PNG, WebP (до 15 МБ)',
    passportSampleBtn: 'Образец ID-карты',
    passportSampleModalTitle: 'Образец: ID-карта Республики Узбекистан',
    passportSampleTip: 'Сфотографируйте документ при хорошем освещении без бликов. Все 4 угла карты должны быть в кадре, текст и цифры должны чётко читаться.',
    passportSampleFrontCaption: '1. Лицевая сторона: фотография, ФИО, ПИНФЛ, серия и номер',
    passportSampleBackCaption: '2. Обратная сторона: адрес прописки, орган выдачи, QR-код',
    sampleIllustrationLabel: 'Образец',
    closeSampleModalBtn: 'Понятно',

    // Section 3: Bank Payout Requisites
    sectionBank: '3. Банковские реквизиты для договора',
    bankRequisitesHelp: 'Эти данные можно посмотреть в приложении банка в деталях карты (реквизиты для перевода): ЦБУ, ИНН, МФО, Транзитный счёт',
    cardLabel: 'Номер карты (UzCard / HUMO) *',
    bankLabel: 'Наименование банка',
    bankPlaceholder: 'Kapitalbank / Anorbank / Ipak Yuli',
    bankBranchLabel: 'Банк / ЦБУ *',
    bankBranchPlaceholder: 'ЦБУ “Янгиабад” / ATIB Ipoteka-bank',
    bankInnLabel: 'ИНН банка (9 цифр) *',
    bankInnPlaceholder: '207112055',
    mfoLabel: 'МФО банка (5 цифр) *',
    mfoPlaceholder: '00450',
    transitAccountLabel: 'Транзитный счёт (20 цифр) *',
    transitAccountPlaceholder: '23120000600011764372',
    phoneLabel: 'Телефон для связи (Telegram / WhatsApp) *',
    phonePlaceholder: '+998 99 999 99 99',

    // Card note vs Contract preview
    cardTransferNote: 'Средства будут зачислены напрямую на указанную карту после согласования выхода рекламы. Подписание бумажного договора не требуется.',
    previewContractBtn: 'Предпросмотр сформированного договора',
    agreementCardCheckbox: 'Подтверждаю правильность указанного номера карты и даю согласие на перевод денежных средств.',
    agreementContractCheckbox: 'Подтверждаю достоверность указанных данных и даю согласие на составление договора и обработку персональных данных.',
    submitBtn: 'Отправить реквизиты в систему',
    footerCopyright: '© 2026 Защищенный шлюз ввода персональных данных.',

    // Modal
    previewModalTitle: 'Предпросмотр договора оказания услуг',
    contractDocTitle: 'ДОГОВОР ОКАЗАНИЯ УСЛУГ',
    contractDateLabel: 'Дата:',
    contractPreamble: 'Настоящий Договор регулирует отношения между Заказчиком и Исполнителем (Блогером):',
    contractFioLabel: 'ФИО Исполнителя:',
    contractStatusLabel: 'Формат сотрудничества:',
    contractPinflLabel: 'ПИНФЛ / ИНН:',
    contractPassportLabel: 'Паспорт / ID:',
    contractIssuedByLabel: 'Кем выдан:',
    contractAddressLabel: 'Адрес регистрации:',
    contractCardLabel: 'Номер карты:',
    contractBankDetailsTitle: 'Банковские реквизиты Исполнителя:',
    contractBankBranchLabel: 'Банк / ЦБУ:',
    contractBankInnLabel: 'ИНН банка / ЦБУ:',
    contractMfoLabel: 'МФО банка:',
    contractTransitAccountLabel: 'Транзитный счёт:',
    contractPhoneLabel: 'Телефон:',
    contractStatusValue: 'Физическое лицо (Исполнитель по договору)',
    contractClause1: '1. ПРЕДМЕТ ДОГОВОРА: Исполнитель (физическое лицо) обязуется оказать рекламные услуги по размещению материалов на медиа-ресурсе',
    contractClause2: '2. ПОРЯДОК РАСЧЕТОВ: Оплата производится Заказчиком на указанный в настоящем документе банковский счет/карту Исполнителя после согласования размещения.',
    contractClause3: '3. КОНФИДЕНЦИАЛЬНОСТЬ: Стороны гарантируют сохранность и неразглашение персональных данных в соответствии с законодательством.',
    contractScansAttached: 'Прикреплённые копии паспорта / ID-карты (обе стороны)',
    contractScansFrontBadge: 'Лицевая сторона',
    contractScansBackBadge: 'Обратная сторона',
    contractScanNotAttached: 'Не прикреплено',
    contractNoScansYet: 'Копии паспорта еще не прикреплены (можно загрузить в форме)',
    contractAutoGenerated: 'Электронный документ сформирован автоматически',
    contractOfferType: 'Электронная оферта',
    closeModalBtn: 'Закрыть окно просмотра',
    placeholderFullName: '[ ФИО Блогера ]',
    placeholderPinfl: '[ 14-значный ПИНФЛ ]',
    placeholderPassport: '[ Серия и Номер ]',
    placeholderCard: '[ Номер карты (16 цифр) ]',
    placeholderBankBranch: '[ Банк / ЦБУ ]',
    placeholderBankInn: '[ ИНН банка (9 цифр) ]',
    placeholderMfo: '[ МФО (5 цифр) ]',
    placeholderTransitAccount: '[ Транзитный счёт (20 цифр) ]'
  },
  uz: {
    pageTitle: 'Rekvizitlar va shartnoma shakli',
    securityGuarantee: 'Ma\'lumotlaringiz to\'liq xavfsiz',
    securityText: 'Kiritilgan rekvizitlar faqat reklama uchun to\'lovni o\'tkazishda ishlatiladi. Biz 100% maxfiylikni kafolatlaymiz: ma\'lumotlar ishonchli himoyalangan va hech kimga berilmaydi.',
    submittedTitle: 'Ma\'lumotlar muvaffaqiyatli yuborildi!',
    submittedText: 'Rekvizitlaringiz qabul qilindi. Moliya bo\'limimiz ma\'lumotlarni tekshiradi va to\'lovni amalga oshiradi.',
    editDataBtn: 'Ma\'lumotlarni tahrirlash',

    // Section 1: Cooperation format
    sectionFormat: '1. Hamkorlik va to\'lov shakli *',
    formatCardTitle: 'Kartaga to\'g\'ridan-to\'g\'ri o\'tkazma',
    formatCardDesc: 'UzCard / HUMO',
    formatContractTitle: 'Rasmiy shartnoma',
    formatContractDesc: 'Jismoniy shaxs bilan elektron xizmat ko\'rsatish shartnomasi',

    // Section 2: Direct Card Payout vs Official Contract
    sectionCardPayout: '2. Kartaga o\'tkazma rekvizitlari',
    sectionPassportRequired: '2. Pasport ma\'lumotlari va JShShIR *',
    fullNameLabel: 'To\'liq F.I.Sh. (pasport bo\'yicha) *',
    fullNamePlaceholder: 'Aliyev Baxtiyor Karimovich',
    pinflLabelRequired: 'JShShIR yoki STIR (14 raqam) *',
    pinflPlaceholder: '30102938475839',
    passportLabelRequired: 'Pasport / ID seriyasi va raqami *',
    passportPlaceholder: 'AD 1234567',
    issuedByLabel: 'Kim tomonidan berilgan (bergan organ)',
    issuedByPlaceholder: 'Mirzo Ulug\'bek tumani IIB',
    addressLabel: 'Doimiy ro\'yxatdan o\'tgan manzili',
    addressPlaceholder: 'Toshkent sh., Navoiy ko\'chasi, 15',

    // Passport scans upload (Two sides)
    passportScansTitle: 'Pasport / ID-karta nusxasi (har ikki tomoni)',
    passportScansSubtitle: 'Shartnomani tuzish uchun pasport yoki ID-kartaning ikki tomoni suratini yuklang',
    passportFrontTitle: 'Old tomoni',
    passportFrontHint: 'Fotosurat va asosiy ma\'lumotlar',
    passportBackTitle: 'Orqa tomoni',
    passportBackHint: 'Ro\'yxatdan o\'tgan manzil / shtamp',
    uploadScanBtn: 'Rasmni tanlash',
    changeScanBtn: 'O\'zgartirish',
    removeScanBtn: 'O\'chirish',
    previewScanBtn: 'Ko\'rish',
    scanUploadedText: 'Yuklandi',
    clickOrDropText: 'Bosing yoki rasmni tashlang',
    supportedFormatsText: 'JPG, PNG, WebP (15 MB gacha)',
    passportSampleBtn: 'ID-karta namunasi',
    passportSampleModalTitle: 'Namuna: O\'zbekiston Respublikasi ID-kartasi',
    passportSampleTip: 'Hujjatni yaxshi yoritilgan joyda, yaltiramasdan suratga oling. ID-kartaning 4 ta burchagi to\'liq ko\'rinishi, yozuvlar va raqamlar aniq o\'qilishi lozim.',
    passportSampleFrontCaption: '1. Old tomoni: fotosurat, F.I.Sh., JShShIR, seriya va raqam',
    passportSampleBackCaption: '2. Orqa tomoni: doimiy yashash manzili, berilgan joyi, QR-kod',
    sampleIllustrationLabel: 'Namuna',
    closeSampleModalBtn: 'Tushunarli',

    // Section 3: Bank Payout Requisites
    sectionBank: '3. Shartnoma uchun bank rekvizitlari',
    bankRequisitesHelp: 'Ushbu ma\'lumotlarni bankingiz mobil ilovasida karta ma\'lumotlaridan (rekvizitlar bo\'limidan) olishingiz mumkin: BXM, STIR, MFO, Tranzit hisob',
    cardLabel: 'Karta raqami (UzCard / HUMO) *',
    bankLabel: 'Bank nomi',
    bankPlaceholder: 'Kapitalbank / Anorbank / Ipak Yo\'li',
    bankBranchLabel: 'Bank / BXM filiali *',
    bankBranchPlaceholder: '“Yangiabod” BXM / ATIB Ipoteka-bank',
    bankInnLabel: 'Bank STIR (9 ta raqam) *',
    bankInnPlaceholder: '207112055',
    mfoLabel: 'Bank MFO (5 ta raqam) *',
    mfoPlaceholder: '00450',
    transitAccountLabel: 'Tranzit hisob raqami (20 ta raqam) *',
    transitAccountPlaceholder: '23120000600011764372',
    phoneLabel: 'Aloqa uchun telefon (Telegram / WhatsApp) *',
    phonePlaceholder: '+998 99 999 99 99',

    // Card note vs Contract preview
    cardTransferNote: 'Mablag\' reklama chiqishi tasdiqlangandan so\'ng to\'g\'ridan-to\'g\'ri ko\'rsatilgan kartaga o\'tkaziladi. Qog\'oz shartnoma talab etilmaydi.',
    previewContractBtn: 'Shakllantirilgan shartnomani ko\'rish',
    agreementCardCheckbox: 'Ko\'rsatilgan karta raqami to\'g\'riligini tasdiqlayman va mablag\' o\'tkazilishiga rozilik beraman.',
    agreementContractCheckbox: 'Ko\'rsatilgan ma\'lumotlarning to\'g\'riligini tasdiqlayman va rasmiy shartnoma tuzish hamda shaxsiy ma\'lumotlarni qayta ishlashga rozilik beraman.',
    submitBtn: 'Rekvizitlarni tizimga yuborish',
    footerCopyright: '© 2026 Shaxsiy ma\'lumotlarni xavfsiz kiritish shlyuzi.',

    // Modal
    previewModalTitle: 'Xizmat ko\'rsatish shartnomasini ko\'rish',
    contractDocTitle: 'XIZMAT KO\'RSATISH SHARTNOMASI',
    contractDateLabel: 'Sana:',
    contractPreamble: 'Ushbu Shartnoma Buyurtmachi va Ijrochi (Bloger) o\'rtasidagi munosabatlarni tartibga soladi:',
    contractFioLabel: 'Ijrochi F.I.Sh.:',
    contractStatusLabel: 'Hamkorlik shakli:',
    contractPinflLabel: 'JShShIR / STIR:',
    contractPassportLabel: 'Pasport / ID:',
    contractIssuedByLabel: 'Kim tomonidan berilgan:',
    contractAddressLabel: 'Doimiy manzil:',
    contractCardLabel: 'Karta raqami:',
    contractBankDetailsTitle: 'Ijrochining bank rekvizitlari:',
    contractBankBranchLabel: 'Bank / BXM:',
    contractBankInnLabel: 'Bank / BXM STIR:',
    contractMfoLabel: 'Bank MFO:',
    contractTransitAccountLabel: 'Tranzit hisob raqami:',
    contractPhoneLabel: 'Telefon:',
    contractStatusValue: 'Jismoniy shaxs (Shartnoma bo\'yicha Ijrochi)',
    contractClause1: '1. SHARTNOMA PREDMETI: Ijrochi (jismoniy shaxs) quyidagi media-resursda reklama materiallarini joylashtirish xizmatlarini ko\'rsatadi:',
    contractClause2: '2. TO\'LOV TARTIBI: To\'lov Buyurtmachi tomonidan ushbu hujjatda ko\'rsatilgan Ijrochining bank hisobiga/kartasiga joylashtirish tasdiqlangandan so\'ng amalga oshiriladi.',
    contractClause3: '3. MAXFIYLIK: Tomonlar shaxsiy ma\'lumotlarning xavfsizligi va daxlsizligini qonunchilikka muvofiq kafolatlaydilar.',
    contractScansAttached: 'Biriktirilgan pasport / ID-karta nusxalari (har ikki tomon)',
    contractScansFrontBadge: 'Old tomoni',
    contractScansBackBadge: 'Orqa tomoni',
    contractScanNotAttached: 'Biriktirilmagan',
    contractNoScansYet: 'Pasport nusxalari hali biriktirilmagan (shaklda yuklash mumkin)',
    contractAutoGenerated: 'Elektron hujjat avtomatik shakllantirilgan',
    contractOfferType: 'Elektron oferta',
    closeModalBtn: 'Ko\'rish oynasini yopish',
    placeholderFullName: '[ Bloger F.I.Sh. ]',
    placeholderPinfl: '[ 14 xonali JShShIR ]',
    placeholderPassport: '[ Seriya va Raqam ]',
    placeholderCard: '[ Karta raqami (16 raqam) ]',
    placeholderBankBranch: '[ Bank / BXM ]',
    placeholderBankInn: '[ Bank STIR (9 ta raqam) ]',
    placeholderMfo: '[ Bank MFO (5 ta raqam) ]',
    placeholderTransitAccount: '[ Tranzit hisob (20 ta raqam) ]'
  },
  en: {
    pageTitle: 'Requisites and Agreement Form',
    securityGuarantee: 'Your details are completely safe',
    securityText: 'Your details are used only to transfer payment for your ad placement. We guarantee 100% confidentiality: your data is securely protected and never shared with third parties.',
    submittedTitle: 'Data Successfully Submitted!',
    submittedText: 'Your requisites have been received. Our finance department will review the details and process payment.',
    editDataBtn: 'Edit Details',

    // Section 1: Cooperation format
    sectionFormat: '1. Collaboration and Payment Format *',
    formatCardTitle: 'Direct Card Transfer',
    formatCardDesc: 'UzCard / HUMO',
    formatContractTitle: 'Official Agreement',
    formatContractDesc: 'Electronic service agreement with an individual',

    // Section 2: Direct Card Payout vs Official Contract
    sectionCardPayout: '2. Card Transfer Details',
    sectionPassportRequired: '2. Passport Details & PINFL *',
    fullNameLabel: 'Full Name (as in passport) *',
    fullNamePlaceholder: 'John Doe',
    pinflLabelRequired: 'PINFL or TIN (14 digits) *',
    pinflPlaceholder: '30102938475839',
    passportLabelRequired: 'Passport / ID Series & Number *',
    passportPlaceholder: 'AD 1234567',
    issuedByLabel: 'Issued By (Authority)',
    issuedByPlaceholder: 'Internal Affairs Department',
    addressLabel: 'Permanent Registration Address',
    addressPlaceholder: 'Tashkent city, Navoi st., 15',

    // Passport scans upload (Two sides)
    passportScansTitle: 'Passport / ID Card Copy (Both Sides)',
    passportScansSubtitle: 'Upload photos or scans of your passport / ID card from both sides for agreement issuance',
    passportFrontTitle: 'Front Side',
    passportFrontHint: 'Photo & identity details',
    passportBackTitle: 'Back Side',
    passportBackHint: 'Address registration / stamp',
    uploadScanBtn: 'Choose Photo',
    changeScanBtn: 'Change',
    removeScanBtn: 'Remove',
    previewScanBtn: 'View',
    scanUploadedText: 'Uploaded',
    clickOrDropText: 'Click or drop photo here',
    supportedFormatsText: 'JPG, PNG, WebP (up to 15MB)',
    passportSampleBtn: 'ID Card Sample',
    passportSampleModalTitle: 'Sample: Republic of Uzbekistan ID Card',
    passportSampleTip: 'Take a clear photo in good lighting without glare. All 4 corners must be in frame, texts and numbers clearly legible.',
    passportSampleFrontCaption: '1. Front side: photo, full name, PINFL, series & number',
    passportSampleBackCaption: '2. Back side: registration address, authority, QR code',
    sampleIllustrationLabel: 'Sample',
    closeSampleModalBtn: 'Got it',

    // Section 3: Bank Payout Requisites
    sectionBank: '3. Bank Requisites for Agreement',
    bankRequisitesHelp: 'You can find these details in your banking app under card details / account requisites: CBU, TIN, MFO, Transit Account',
    cardLabel: 'Card Number (UzCard / HUMO) *',
    bankLabel: 'Bank Name',
    bankPlaceholder: 'Kapitalbank / Anorbank / Ipak Yuli',
    bankBranchLabel: 'Bank / Branch (CBU) *',
    bankBranchPlaceholder: 'CBU “Yangiabad” / ATIB Ipoteka-bank',
    bankInnLabel: 'Bank TIN (9 digits) *',
    bankInnPlaceholder: '207112055',
    mfoLabel: 'Bank MFO (5 digits) *',
    mfoPlaceholder: '00450',
    transitAccountLabel: 'Transit Account (20 digits) *',
    transitAccountPlaceholder: '23120000600011764372',
    phoneLabel: 'Contact Phone (Telegram / WhatsApp) *',
    phonePlaceholder: '+998 99 999 99 99',

    // Card note vs Contract preview
    cardTransferNote: 'Funds will be transferred directly to the specified card after ad placement is approved. No contract signing required.',
    previewContractBtn: 'Preview Generated Agreement',
    agreementCardCheckbox: 'I confirm the accuracy of the card number and consent to the payment transfer.',
    agreementContractCheckbox: 'I confirm the accuracy of the provided data and consent to contract drafting and personal data processing.',
    submitBtn: 'Submit Requisites to System',
    footerCopyright: '© 2026 Secure personal data gateway.',

    // Modal
    previewModalTitle: 'Service Agreement Preview',
    contractDocTitle: 'SERVICE AGREEMENT',
    contractDateLabel: 'Date:',
    contractPreamble: 'This Agreement governs the relationship between the Customer and the Contractor (Blogger):',
    contractFioLabel: 'Contractor Full Name:',
    contractStatusLabel: 'Collaboration Format:',
    contractPinflLabel: 'PINFL / TIN:',
    contractPassportLabel: 'Passport / ID:',
    contractIssuedByLabel: 'Issued By:',
    contractAddressLabel: 'Permanent Address:',
    contractCardLabel: 'Card Number:',
    contractBankDetailsTitle: 'Contractor Bank Requisites:',
    contractBankBranchLabel: 'Bank / CBU:',
    contractBankInnLabel: 'Bank TIN:',
    contractMfoLabel: 'Bank MFO:',
    contractTransitAccountLabel: 'Transit Account:',
    contractPhoneLabel: 'Phone:',
    contractStatusValue: 'Individual (Contractor under agreement)',
    contractClause1: '1. SUBJECT OF AGREEMENT: The Contractor (individual) undertakes to provide advertising placement services on the media resource',
    contractClause2: '2. PAYMENT TERMS: Payment is made by the Customer to the Contractor\'s bank account/card specified in this document upon placement verification.',
    contractClause3: '3. CONFIDENTIALITY: The parties guarantee the security and non-disclosure of personal data in accordance with legislation.',
    contractScansAttached: 'Attached Passport / ID Card Copies (Both Sides)',
    contractScansFrontBadge: 'Front Side',
    contractScansBackBadge: 'Back Side',
    contractScanNotAttached: 'Not attached',
    contractNoScansYet: 'Passport copies not attached yet (can be uploaded in the form)',
    contractAutoGenerated: 'Electronic document generated automatically',
    contractOfferType: 'Electronic offer',
    closeModalBtn: 'Close Preview',
    placeholderFullName: '[ Blogger Full Name ]',
    placeholderPinfl: '[ 14-digit PINFL ]',
    placeholderPassport: '[ Series & Number ]',
    placeholderCard: '[ Card Number (16 digits) ]',
    placeholderBankBranch: '[ Bank / CBU ]',
    placeholderBankInn: '[ Bank TIN (9 digits) ]',
    placeholderMfo: '[ Bank MFO (5 digits) ]',
    placeholderTransitAccount: '[ Transit Account (20 digits) ]'
  }
};

export default function BloggerRequisitesView({
  integrationToken,
  integrations = [],
  onSubmitRequisites,
  onBack,
  lang = 'ru',
  setLang
}: BloggerRequisitesViewProps) {
  const [currentLang, setCurrentLang] = useState<Language>(() => {
    if (lang) return lang;
    const cached = localStorage.getItem('ff_lang');
    return (cached as Language) || 'ru';
  });

  useEffect(() => {
    if (lang) {
      setCurrentLang(lang);
    }
  }, [lang]);

  const handleLanguageChange = (l: Language) => {
    setCurrentLang(l);
    if (setLang) {
      setLang(l);
    }
    localStorage.setItem('ff_lang', l);
  };

  const rt = requisitesTranslations[currentLang] || requisitesTranslations['ru'];

  // Resolve integration from token or fallback to demo context
  const activeIntegration = integrations.find(i => i.id === integrationToken) || {
    id: integrationToken || 'demo-integration-id',
    bloggerName: '@blogger_official',
    platform: 'Instagram' as const,
    totalAmount: 1500000,
    pricePerSlot: 1500000,
    slotsCount: 1
  };

  // Form State - 2 formats: 'card_transfer' or 'contract'
  const [taxStatus, setTaxStatus] = useState<'card_transfer' | 'contract'>('card_transfer');
  const [fullName, setFullName] = useState('');
  const [passportSeriesNumber, setPassportSeriesNumber] = useState('');
  const [pinflOrTin, setPinflOrTin] = useState('');
  const [passportIssueDate, setPassportIssueDate] = useState('');
  const [passportIssuedBy, setPassportIssuedBy] = useState('');
  const [registrationAddress, setRegistrationAddress] = useState('');
  const [passportFrontScan, setPassportFrontScan] = useState<string | null>(null);
  const [passportBackScan, setPassportBackScan] = useState<string | null>(null);
  const [cardNumberOrIban, setCardNumberOrIban] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankInn, setBankInn] = useState('');
  const [mfo, setMfo] = useState('');
  const [transitAccount, setTransitAccount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegramHandle, setTelegramHandle] = useState('');
  const [agreementChecked, setAgreementChecked] = useState(true);

  const [isPreviewContractOpen, setIsPreviewContractOpen] = useState(false);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [activeLightboxImg, setActiveLightboxImg] = useState<{ src: string; title: string } | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  // Auto-fill recipient name if empty when full name changes
  useEffect(() => {
    if (!recipientName && fullName) {
      setRecipientName(fullName);
    }
  }, [fullName]);

  const handleFileUpload = async (side: 'front' | 'back', file: File) => {
    if (!file) return;
    try {
      const base64 = await compressImage(file);
      if (side === 'front') {
        setPassportFrontScan(base64);
      } else {
        setPassportBackScan(base64);
      }
    } catch (err) {
      console.error('Failed to compress scan image:', err);
    }
  };

  const handleFileInputChange = (side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(side, file);
    }
    e.target.value = '';
  };

  // Handle Card formatting (spaces every 4 digits)
  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 16 && !val.startsWith('UZ') && !val.startsWith('HU')) {
      val = val.substring(0, 16);
    }
    const formatted = val.replace(/(.{4})/g, '$1 ').trim();
    setCardNumberOrIban(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!fullName.trim() || !cardNumberOrIban.trim()) return;
    if (taxStatus === 'contract' && (!pinflOrTin.trim() || !passportSeriesNumber.trim())) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      if (onSubmitRequisites) {
        await onSubmitRequisites(activeIntegration.id, {
          integrationId: activeIntegration.id,
          bloggerName: activeIntegration.bloggerName,
          taxStatus,
          fullName,
          passportSeriesNumber,
          pinflOrTin,
          passportIssueDate,
          passportIssuedBy,
          registrationAddress,
          passportFrontScan: passportFrontScan || undefined,
          passportBackScan: passportBackScan || undefined,
          cardNumberOrIban,
          bankName,
          bankInn,
          mfo,
          transitAccount,
          recipientName: recipientName || fullName,
          phone,
          telegramHandle
        });
      }

      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Failed to submit requisites:', err);
      setSubmitError(err?.message || (currentLang === 'uz' ? 'Xatolik yuz berdi. Iltimos, qaytadan urinib ko‘ring.' : 'Произошла ошибка при отправке. Пожалуйста, попробуйте еще раз.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 font-sans antialiased">
      {/* Top Bar with Language Switcher */}
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-800 font-bold text-xs rounded-xl border border-neutral-200 transition cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{currentLang === 'uz' ? 'Orqaga' : 'Назад в реестр'}</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center font-bold text-white shrink-0">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-xl text-black tracking-tight">Tezi.uz</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-white border border-neutral-200 p-1 rounded-xl shadow-2xs">
          {(['ru', 'uz', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => handleLanguageChange(l)}
              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg transition cursor-pointer ${
                currentLang === l
                  ? 'bg-black text-white'
                  : 'text-neutral-500 hover:text-black hover:bg-neutral-100'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* Header Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            {rt.pageTitle}
          </h1>
        </div>

        {/* Data Privacy & Security Notice - Green Friendly Card */}
        <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs flex items-start gap-3.5">
          <div className="p-2.5 bg-emerald-100 rounded-xl border border-emerald-200 text-emerald-700 shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="space-y-1 text-xs">
            <h4 className="font-black text-emerald-950 text-xs sm:text-sm flex items-center gap-1.5">
              {rt.securityGuarantee}
            </h4>
            <p className="text-emerald-800/90 leading-relaxed font-medium text-xs">
              {rt.securityText}
            </p>
          </div>
        </div>

        {/* Main Card Form */}
        {isSubmitted ? (
          <div className="bg-white border border-neutral-200 rounded-3xl p-8 text-center space-y-6 shadow-xs">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-neutral-900">{rt.submittedTitle}</h2>
              <p className="text-neutral-500 text-xs font-medium max-w-md mx-auto">
                {rt.submittedText}
              </p>
            </div>
            <div className="pt-4 border-t border-neutral-100">
              <button
                onClick={() => setIsSubmitted(false)}
                className="px-6 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {rt.editDataBtn}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
            {/* Section 1: Cooperation and Payment Format */}
            <div className="space-y-3">
              <label className="block text-xs font-black text-neutral-700 uppercase tracking-wider">
                {rt.sectionFormat}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTaxStatus('card_transfer')}
                  className={`p-4 rounded-2xl border text-left transition flex items-start gap-3.5 cursor-pointer ${
                    taxStatus === 'card_transfer'
                      ? 'bg-black border-black text-white shadow-sm ring-2 ring-black/20'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${taxStatus === 'card_transfer' ? 'bg-white/10 text-white' : 'bg-white text-black border border-neutral-200'}`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black block">
                      {rt.formatCardTitle}
                    </span>
                    <span className={`text-[11px] leading-tight block mt-1 ${taxStatus === 'card_transfer' ? 'text-neutral-300 font-normal' : 'text-neutral-500 font-medium'}`}>
                      {rt.formatCardDesc}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTaxStatus('contract')}
                  className={`p-4 rounded-2xl border text-left transition flex items-start gap-3.5 cursor-pointer ${
                    taxStatus === 'contract'
                      ? 'bg-black border-black text-white shadow-sm ring-2 ring-black/20'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${taxStatus === 'contract' ? 'bg-white/10 text-white' : 'bg-white text-black border border-neutral-200'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black block">
                      {rt.formatContractTitle}
                    </span>
                    <span className={`text-[11px] leading-tight block mt-1 ${taxStatus === 'contract' ? 'text-neutral-300 font-normal' : 'text-neutral-500 font-medium'}`}>
                      {rt.formatContractDesc}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Direct Card Transfer Payout Fields */}
            {taxStatus === 'card_transfer' ? (
              <div className="space-y-4 pt-4 border-t border-neutral-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-black" />
                  <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wider">
                    {rt.sectionCardPayout}
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1">
                      {rt.fullNameLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={rt.fullNamePlaceholder}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1">
                      {rt.cardLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={cardNumberOrIban}
                      onChange={handleCardChange}
                      placeholder="8600 0000 0000 0000"
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-mono tracking-wider font-extrabold text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 mb-1">
                        {rt.bankLabel}
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder={rt.bankPlaceholder}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 mb-1">
                        {rt.phoneLabel}
                      </label>
                      <input
                        type="text"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={rt.phonePlaceholder}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Section 2: Passport / Identity Data for Official Contract */}
                <div className="space-y-4 pt-4 border-t border-neutral-100">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-black" />
                    <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wider">
                      {rt.sectionPassportRequired}
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 mb-1">
                        {rt.fullNameLabel}
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={rt.fullNamePlaceholder}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1">
                          {rt.pinflLabelRequired}
                        </label>
                        <input
                          type="text"
                          required
                          value={pinflOrTin}
                          onChange={(e) => setPinflOrTin(e.target.value.replace(/\D/g, '').slice(0, 14))}
                          placeholder={rt.pinflPlaceholder}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1">
                          {rt.passportLabelRequired}
                        </label>
                        <input
                          type="text"
                          required
                          value={passportSeriesNumber}
                          onChange={(e) => setPassportSeriesNumber(e.target.value.toUpperCase())}
                          placeholder={rt.passportPlaceholder}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1">
                          {rt.issuedByLabel}
                        </label>
                        <input
                          type="text"
                          value={passportIssuedBy}
                          onChange={(e) => setPassportIssuedBy(e.target.value)}
                          placeholder={rt.issuedByPlaceholder}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1">
                          {rt.addressLabel}
                        </label>
                        <input
                          type="text"
                          value={registrationAddress}
                          onChange={(e) => setRegistrationAddress(e.target.value)}
                          placeholder={rt.addressPlaceholder}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </div>
                    </div>

                    {/* Passport Scans (Both Sides) Upload */}
                    <div className="pt-3 border-t border-neutral-100 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                          <FileCheck className="w-4 h-4 text-black" />
                          <span>{rt.passportScansTitle}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsSampleModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-xl transition cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-neutral-600" />
                          <span>{rt.passportSampleBtn}</span>
                        </button>
                      </div>

                      {/* Hidden file inputs */}
                      <input
                        type="file"
                        ref={frontInputRef}
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileInputChange('front', e)}
                        className="hidden"
                      />
                      <input
                        type="file"
                        ref={backInputRef}
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileInputChange('back', e)}
                        className="hidden"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Front Side Upload Card */}
                        <div 
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleFileUpload('front', file);
                          }}
                          className={`relative rounded-2xl border transition-all p-3.5 flex flex-col justify-between ${
                            passportFrontScan 
                              ? 'bg-neutral-50/90 border-neutral-300' 
                              : 'bg-white border-2 border-dashed border-neutral-300 hover:border-black hover:bg-neutral-50/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-neutral-900">{rt.passportFrontTitle}</span>
                            </div>
                            {passportFrontScan ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {rt.scanUploadedText}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsSampleModalOpen(true);
                                }}
                                className="text-[10px] font-bold text-neutral-500 hover:text-black flex items-center gap-1 bg-neutral-100 hover:bg-neutral-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>{rt.sampleIllustrationLabel}</span>
                              </button>
                            )}
                          </div>

                          {passportFrontScan ? (
                            <div className="space-y-2">
                              <div 
                                onClick={() => setActiveLightboxImg({ src: passportFrontScan, title: rt.passportFrontTitle })}
                                className="relative h-32 rounded-xl overflow-hidden border border-neutral-200 bg-black/5 group cursor-pointer"
                              >
                                <img 
                                  src={passportFrontScan} 
                                  alt={rt.passportFrontTitle}
                                  className="w-full h-full object-cover transition duration-200 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                                  <ZoomIn className="w-4 h-4" />
                                  <span>{rt.previewScanBtn}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => frontInputRef.current?.click()}
                                    className="px-2.5 py-1.5 text-[11px] font-bold text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition cursor-pointer"
                                  >
                                    {rt.changeScanBtn}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsSampleModalOpen(true)}
                                    className="px-2 py-1.5 text-[11px] font-medium text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-lg transition cursor-pointer flex items-center gap-1"
                                    title={rt.passportSampleBtn}
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>{rt.sampleIllustrationLabel}</span>
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setPassportFrontScan(null)}
                                  className="px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>{rt.removeScanBtn}</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              onClick={() => frontInputRef.current?.click()}
                              className="py-2 flex flex-col items-center justify-center text-center cursor-pointer space-y-2.5 select-none group"
                            >
                              {/* Illustrated Front Sample */}
                              <div className="relative w-full max-w-[250px] aspect-[368/232] rounded-xl overflow-hidden border border-neutral-200 shadow-2xs bg-neutral-100 group-hover:border-black/60 group-hover:shadow-xs transition duration-200">
                                <img 
                                  src={idCardSampleFront} 
                                  alt={rt.passportFrontTitle}
                                  className="w-full h-full object-cover group-hover:scale-102 transition duration-200"
                                />
                                <div className="absolute top-1.5 left-1.5 bg-black/75 backdrop-blur-xs text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                                  <span>{rt.sampleIllustrationLabel}</span>
                                </div>
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                  <div className="bg-black text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5">
                                    <UploadCloud className="w-3.5 h-3.5" />
                                    <span>{rt.uploadScanBtn}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-neutral-800 flex items-center justify-center gap-1">
                                  <UploadCloud className="w-3.5 h-3.5 text-neutral-500" />
                                  <span>{rt.clickOrDropText}</span>
                                </p>
                                <p className="text-[10px] text-neutral-400 font-medium">{rt.supportedFormatsText}</p>
                              </div>

                              <button
                                type="button"
                                className="px-3.5 py-1.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                              >
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span>{rt.uploadScanBtn}</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Back Side Upload Card */}
                        <div 
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleFileUpload('back', file);
                          }}
                          className={`relative rounded-2xl border transition-all p-3.5 flex flex-col justify-between ${
                            passportBackScan 
                              ? 'bg-neutral-50/90 border-neutral-300' 
                              : 'bg-white border-2 border-dashed border-neutral-300 hover:border-black hover:bg-neutral-50/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-neutral-900">{rt.passportBackTitle}</span>
                            </div>
                            {passportBackScan ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {rt.scanUploadedText}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsSampleModalOpen(true);
                                }}
                                className="text-[10px] font-bold text-neutral-500 hover:text-black flex items-center gap-1 bg-neutral-100 hover:bg-neutral-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>{rt.sampleIllustrationLabel}</span>
                              </button>
                            )}
                          </div>

                          {passportBackScan ? (
                            <div className="space-y-2">
                              <div 
                                onClick={() => setActiveLightboxImg({ src: passportBackScan, title: rt.passportBackTitle })}
                                className="relative h-32 rounded-xl overflow-hidden border border-neutral-200 bg-black/5 group cursor-pointer"
                              >
                                <img 
                                  src={passportBackScan} 
                                  alt={rt.passportBackTitle}
                                  className="w-full h-full object-cover transition duration-200 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                                  <ZoomIn className="w-4 h-4" />
                                  <span>{rt.previewScanBtn}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => backInputRef.current?.click()}
                                    className="px-2.5 py-1.5 text-[11px] font-bold text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition cursor-pointer"
                                  >
                                    {rt.changeScanBtn}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsSampleModalOpen(true)}
                                    className="px-2 py-1.5 text-[11px] font-medium text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-lg transition cursor-pointer flex items-center gap-1"
                                    title={rt.passportSampleBtn}
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>{rt.sampleIllustrationLabel}</span>
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setPassportBackScan(null)}
                                  className="px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>{rt.removeScanBtn}</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              onClick={() => backInputRef.current?.click()}
                              className="py-2 flex flex-col items-center justify-center text-center cursor-pointer space-y-2.5 select-none group"
                            >
                              {/* Illustrated Back Sample */}
                              <div className="relative w-full max-w-[250px] aspect-[368/232] rounded-xl overflow-hidden border border-neutral-200 shadow-2xs bg-neutral-100 group-hover:border-black/60 group-hover:shadow-xs transition duration-200">
                                <img 
                                  src={idCardSampleBack} 
                                  alt={rt.passportBackTitle}
                                  className="w-full h-full object-cover group-hover:scale-102 transition duration-200"
                                />
                                <div className="absolute top-1.5 left-1.5 bg-black/75 backdrop-blur-xs text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                                  <span>{rt.sampleIllustrationLabel}</span>
                                </div>
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                  <div className="bg-black text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5">
                                    <UploadCloud className="w-3.5 h-3.5" />
                                    <span>{rt.uploadScanBtn}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-neutral-800 flex items-center justify-center gap-1">
                                  <UploadCloud className="w-3.5 h-3.5 text-neutral-500" />
                                  <span>{rt.clickOrDropText}</span>
                                </p>
                                <p className="text-[10px] text-neutral-400 font-medium">{rt.supportedFormatsText}</p>
                              </div>

                              <button
                                type="button"
                                className="px-3.5 py-1.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                              >
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span>{rt.uploadScanBtn}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Bank Payout Requisites for Contract */}
                <div className="space-y-4 pt-4 border-t border-neutral-100">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-black" />
                    <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wider">
                      {rt.sectionBank}
                    </h3>
                  </div>

                  {/* Helpful Tip about where to find banking requisites */}
                  <div className="p-3 bg-neutral-100 border border-neutral-200 rounded-xl flex items-start gap-2.5 text-neutral-600 text-xs">
                    <Sparkles className="w-4 h-4 text-neutral-800 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">
                      {rt.bankRequisitesHelp}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Card Number */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 mb-1">
                        {rt.cardLabel}
                      </label>
                      <input
                        type="text"
                        required
                        value={cardNumberOrIban}
                        onChange={handleCardChange}
                        placeholder="9860 9860 9860 9860"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-mono tracking-wider font-extrabold text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                      />
                    </div>

                    {/* Bank/Branch/CBU, INN, MFO */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div className="flex flex-col justify-end">
                        <label className="block text-xs font-semibold text-neutral-600 mb-1.5 sm:min-h-[1.75rem] flex items-end">
                          {rt.bankBranchLabel}
                        </label>
                        <input
                          type="text"
                          required
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder={rt.bankBranchPlaceholder}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </div>

                      <div className="flex flex-col justify-end">
                        <label className="block text-xs font-semibold text-neutral-600 mb-1.5 sm:min-h-[1.75rem] flex items-end">
                          {rt.bankInnLabel}
                        </label>
                        <input
                          type="text"
                          required
                          value={bankInn}
                          onChange={(e) => setBankInn(e.target.value.replace(/\D/g, '').slice(0, 9))}
                          placeholder={rt.bankInnPlaceholder}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono font-bold text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </div>

                      <div className="flex flex-col justify-end">
                        <label className="block text-xs font-semibold text-neutral-600 mb-1.5 sm:min-h-[1.75rem] flex items-end">
                          {rt.mfoLabel}
                        </label>
                        <input
                          type="text"
                          required
                          value={mfo}
                          onChange={(e) => setMfo(e.target.value.replace(/\D/g, '').slice(0, 5))}
                          placeholder={rt.mfoPlaceholder}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono font-bold text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </div>
                    </div>

                    {/* Transit Account & Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1">
                          {rt.transitAccountLabel}
                        </label>
                        <input
                          type="text"
                          required
                          value={transitAccount}
                          onChange={(e) => setTransitAccount(e.target.value.replace(/\D/g, '').slice(0, 20))}
                          placeholder={rt.transitAccountPlaceholder}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono font-bold text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1">
                          {rt.phoneLabel}
                        </label>
                        <input
                          type="text"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder={rt.phonePlaceholder}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Contract Interactive Preview or Direct Transfer Note */}
            {taxStatus === 'contract' ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewContractOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-black" />
                  <span>{rt.previewContractBtn}</span>
                </button>
              </div>
            ) : (
              <div className="pt-1 p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-600 flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{rt.cardTransferNote}</span>
              </div>
            )}

            {/* Agreement Checkbox */}
            <div className="pt-4 border-t border-neutral-100 flex items-start gap-3">
              <input
                type="checkbox"
                id="agreement"
                checked={agreementChecked}
                onChange={(e) => setAgreementChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-black focus:ring-black bg-neutral-100 border-neutral-300 cursor-pointer"
              />
              <label htmlFor="agreement" className="text-xs text-neutral-600 cursor-pointer select-none font-medium leading-relaxed">
                {taxStatus === 'contract' ? rt.agreementContractCheckbox : rt.agreementCardCheckbox}
              </label>
            </div>

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{submitError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!agreementChecked || isSubmitting}
              className="w-full py-4 bg-black hover:bg-neutral-800 active:bg-neutral-900 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition duration-150 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  <span>{currentLang === 'uz' ? 'Yuborilmoqda...' : 'Отправка...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>{rt.submitBtn}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-neutral-400 font-medium space-y-1">
          <p>{rt.footerCopyright}</p>
        </div>
      </div>

      {/* Contract Interactive Preview Modal */}
      {isPreviewContractOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl text-neutral-900 my-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-black" />
                <h3 className="font-extrabold text-base text-neutral-900">
                  {rt.previewModalTitle}
                </h3>
              </div>
              <button
                onClick={() => setIsPreviewContractOpen(false)}
                className="text-neutral-400 hover:text-black font-bold text-lg cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Contract Document Render */}
            <div className="bg-neutral-50 text-neutral-900 p-6 sm:p-8 rounded-2xl space-y-5 text-xs leading-relaxed border border-neutral-200 shadow-inner">
              {/* Document Header (NO City, Only Title and Date) */}
              <div className="text-center border-b border-neutral-200 pb-4 space-y-1">
                <h4 className="font-extrabold text-sm uppercase tracking-wide text-neutral-900">{rt.contractDocTitle}</h4>
                <p className="text-[11px] text-neutral-500 font-medium">
                  {rt.contractDateLabel} {new Date().toLocaleDateString(currentLang === 'uz' ? 'uz-UZ' : currentLang === 'en' ? 'en-US' : 'ru-RU')}
                </p>
              </div>

              {/* Preamble (NO Organization Name) */}
              <p className="text-neutral-800 leading-relaxed font-medium">
                {rt.contractPreamble}
              </p>

              {/* Parties / Blogger Requisites Grid */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 space-y-2.5 text-xs shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">{rt.contractFioLabel}</span>
                    <span className="font-bold text-neutral-900 text-xs">{fullName || rt.placeholderFullName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">{rt.contractStatusLabel}</span>
                    <span className="font-semibold text-neutral-800 text-xs">{rt.contractStatusValue}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">{rt.contractPinflLabel}</span>
                    <span className="font-mono font-bold text-neutral-900 text-xs">{pinflOrTin || rt.placeholderPinfl}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">{rt.contractPassportLabel}</span>
                    <span className="font-mono font-bold text-neutral-900 text-xs">{passportSeriesNumber || rt.placeholderPassport}</span>
                  </div>
                  {passportIssuedBy && (
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">{rt.contractIssuedByLabel}</span>
                      <span className="font-medium text-neutral-800 text-xs">{passportIssuedBy}</span>
                    </div>
                  )}
                  {registrationAddress && (
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">{rt.contractAddressLabel}</span>
                      <span className="font-medium text-neutral-800 text-xs">{registrationAddress}</span>
                    </div>
                  )}
                  <div className="sm:col-span-2 pt-3 border-t border-neutral-100 space-y-2">
                    <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">
                      {rt.contractBankDetailsTitle}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                      <div>
                        <span className="text-[10px] text-neutral-400 font-bold block uppercase">{rt.contractCardLabel}</span>
                        <span className="font-mono font-bold text-neutral-900 text-xs">{cardNumberOrIban || rt.placeholderCard}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 font-bold block uppercase">{rt.contractBankBranchLabel}</span>
                        <span className="font-semibold text-neutral-800 text-xs">{bankName || rt.placeholderBankBranch}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 font-bold block uppercase">{rt.contractBankInnLabel}</span>
                        <span className="font-mono font-medium text-neutral-800 text-xs">{bankInn || rt.placeholderBankInn}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 font-bold block uppercase">{rt.contractMfoLabel}</span>
                        <span className="font-mono font-medium text-neutral-800 text-xs">{mfo || rt.placeholderMfo}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-[10px] text-neutral-400 font-bold block uppercase">{rt.contractTransitAccountLabel}</span>
                        <span className="font-mono font-bold text-neutral-900 text-xs">{transitAccount || rt.placeholderTransitAccount}</span>
                      </div>
                      {phone && (
                        <div className="sm:col-span-2">
                          <span className="text-[10px] text-neutral-400 font-bold block uppercase">{rt.contractPhoneLabel}</span>
                          <span className="font-medium text-neutral-800 text-xs">{phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Attached Passport Copies (Two Sides) */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 space-y-3 text-xs shadow-2xs">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-neutral-900 flex items-center gap-1.5 text-xs">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>{rt.contractScansAttached}</span>
                  </h5>
                  {(passportFrontScan || passportBackScan) && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      {passportFrontScan && passportBackScan ? '2 / 2' : '1 / 2'} {rt.scanUploadedText}
                    </span>
                  )}
                </div>

                {passportFrontScan || passportBackScan ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {passportFrontScan ? (
                      <div 
                        onClick={() => setActiveLightboxImg({ src: passportFrontScan, title: rt.contractScansFrontBadge })}
                        className="group relative rounded-xl border border-neutral-200 overflow-hidden cursor-pointer bg-neutral-50 hover:border-black transition"
                      >
                        <img 
                          src={passportFrontScan} 
                          alt={rt.contractScansFrontBadge} 
                          className="w-full h-28 object-cover group-hover:scale-105 transition duration-200" 
                        />
                        <div className="p-2 bg-white/95 border-t border-neutral-100 flex items-center justify-between px-3">
                          <span className="text-[11px] font-bold text-neutral-800">{rt.contractScansFrontBadge}</span>
                          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                            <ZoomIn className="w-3 h-3" /> {rt.previewScanBtn}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-neutral-200 p-4 flex flex-col items-center justify-center text-center text-xs text-neutral-400">
                        <span className="font-bold text-neutral-600">{rt.contractScansFrontBadge}</span>
                        <span className="text-[10px] text-neutral-400 mt-1">{rt.contractScanNotAttached}</span>
                      </div>
                    )}

                    {passportBackScan ? (
                      <div 
                        onClick={() => setActiveLightboxImg({ src: passportBackScan, title: rt.contractScansBackBadge })}
                        className="group relative rounded-xl border border-neutral-200 overflow-hidden cursor-pointer bg-neutral-50 hover:border-black transition"
                      >
                        <img 
                          src={passportBackScan} 
                          alt={rt.contractScansBackBadge} 
                          className="w-full h-28 object-cover group-hover:scale-105 transition duration-200" 
                        />
                        <div className="p-2 bg-white/95 border-t border-neutral-100 flex items-center justify-between px-3">
                          <span className="text-[11px] font-bold text-neutral-800">{rt.contractScansBackBadge}</span>
                          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                            <ZoomIn className="w-3 h-3" /> {rt.previewScanBtn}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-neutral-200 p-4 flex flex-col items-center justify-center text-center text-xs text-neutral-400">
                        <span className="font-bold text-neutral-600">{rt.contractScansBackBadge}</span>
                        <span className="text-[10px] text-neutral-400 mt-1">{rt.contractScanNotAttached}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-neutral-100/60 rounded-xl border border-neutral-200 text-xs text-neutral-500 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-neutral-400 shrink-0" />
                    <span>{rt.contractNoScansYet}</span>
                  </div>
                )}
              </div>

              {/* Terms & Clauses */}
              <div className="space-y-2 text-xs text-neutral-700 leading-relaxed">
                <p><strong>{rt.contractClause1}</strong> <span className="font-bold text-black">{activeIntegration.bloggerName}</span>.</p>
                <p><strong>{rt.contractClause2}</strong></p>
                <p><strong>{rt.contractClause3}</strong></p>
              </div>

              {/* Document Footer */}
              <div className="pt-4 border-t border-neutral-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-neutral-500">
                <span>{rt.contractAutoGenerated}</span>
                <span className="font-bold text-black">{rt.contractOfferType}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsPreviewContractOpen(false)}
                className="px-5 py-2.5 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {rt.closeModalBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Zoom Modal for Passport Scans */}
      {activeLightboxImg && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          onClick={() => setActiveLightboxImg(null)}
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between text-white pb-3">
              <span className="font-bold text-sm">{activeLightboxImg.title}</span>
              <button
                type="button"
                onClick={() => setActiveLightboxImg(null)}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={activeLightboxImg.src}
              alt={activeLightboxImg.title}
              className="max-h-[80vh] w-auto max-w-full rounded-2xl border border-white/20 shadow-2xl object-contain bg-neutral-900"
            />
          </div>
        </div>
      )}

      {/* ID Card Sample Reference Modal */}
      {isSampleModalOpen && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setIsSampleModalOpen(false)}
        >
          <div 
            className="bg-white border border-neutral-200 rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-5 shadow-2xl text-neutral-900 my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3.5">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-black" />
                <h3 className="font-extrabold text-base text-neutral-900">
                  {rt.passportSampleModalTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSampleModalOpen(false)}
                className="text-neutral-400 hover:text-black font-bold text-lg cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Illustration Display */}
            <div className="space-y-3.5">
              <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-sm bg-neutral-50">
                <img 
                  src={idCardSampleFull} 
                  alt="Uzbekistan ID Card Sample" 
                  className="w-full h-auto object-contain"
                />
              </div>

              {/* Two Column Captions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                  <span className="font-extrabold text-black block">{rt.passportFrontTitle}</span>
                  <p className="text-[11px] text-neutral-600 font-medium leading-relaxed">
                    {rt.passportSampleFrontCaption}
                  </p>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                  <span className="font-extrabold text-black block">{rt.passportBackTitle}</span>
                  <p className="text-[11px] text-neutral-600 font-medium leading-relaxed">
                    {rt.passportSampleBackCaption}
                  </p>
                </div>
              </div>

              {/* Useful Guidelines Alert */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-start gap-2.5 text-emerald-950">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">
                  {rt.passportSampleTip}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsSampleModalOpen(false)}
                className="px-5 py-2.5 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {rt.closeSampleModalBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
