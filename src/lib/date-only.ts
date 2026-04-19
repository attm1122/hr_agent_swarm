// Strangler-fig barrel — re-export from domain layer
export {
  type DateOnlyParts,
  parseDateOnly,
  formatDateOnly,
  toUTCDateFromDateOnly,
  toDateOnlyString,
  compareDateOnly,
  differenceInDateOnlyDays,
  addDaysToDateOnly,
  getDateOnlyRelativeState,
  differenceFromTodayInDateOnlyDays,
  getFullYearsSinceDateOnly,
} from '@/lib/domain/shared/date-value';
