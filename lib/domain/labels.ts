// Thai display labels for domain enums (pure, client-safe).
import type { SpecimenType } from './types';

export const SPECIMEN_LABEL_TH: Record<SpecimenType, string> = {
  BLOOD: 'เลือด (Blood)',
  RESPIRATORY: 'ทางเดินหายใจ (Respiratory)',
  URINE: 'ปัสสาวะ (Urine)',
  WOUND: 'แผล/หนอง (Wound)',
  OTHER: 'อื่น ๆ',
};

export const WARD_TYPE_LABEL_TH = { ICU: 'ICU', NON_ICU: 'Non-ICU', UNKNOWN: 'ไม่ทราบ ward' } as const;
