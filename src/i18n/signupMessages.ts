export const SIGNUP_EN_MESSAGES = {
  "signup.title": "Create your account",
  "signup.intro": "Start preparing your own seminars with BudoGraph.",
  "signup.name": "Display name",
  "signup.confirm": "Confirm password",
  "signup.passwordHint":
    "Use 8–128 characters. Verify your email before signing in.",
  "signup.show": "Show passwords",
  "signup.hide": "Hide passwords",
  "signup.submit": "Create account",
  "signup.submitting": "Submitting…",
  "signup.login": "Already have an account? Sign in",
  "signup.closed": "Registration is currently closed",
  "signup.closedDetail": "New public accounts are not available at the moment.",
  "signup.invalidName":
    "Enter a display name of 1–100 characters, without control characters or angle brackets.",
  "signup.invalidEmail": "Enter a valid email address.",
  "signup.invalidPassword": "Use a password of 8–128 characters.",
  "signup.mismatch": "The passwords do not match.",
  "signup.limited": "Too many requests. Please wait before trying again.",
  "signup.unavailable":
    "Registration is temporarily unavailable. Please try again later.",
  "signup.failed":
    "The request could not be completed. Check your entries and try again.",
} as const;
export const SIGNUP_BG_MESSAGES = {
  "signup.title": "Създайте своя акаунт",
  "signup.intro": "Започнете подготовката на своите семинари с BudoGraph.",
  "signup.name": "Показвано име",
  "signup.confirm": "Повторете паролата",
  "signup.passwordHint":
    "Използвайте 8–128 символа. Потвърдете имейла си преди вход.",
  "signup.show": "Покажете паролите",
  "signup.hide": "Скрийте паролите",
  "signup.submit": "Създаване на акаунт",
  "signup.submitting": "Изпращане…",
  "signup.login": "Вече имате акаунт? Влезте",
  "signup.closed": "Регистрацията в момента е затворена",
  "signup.closedDetail":
    "В момента не е достъпно създаването на нови публични акаунти.",
  "signup.invalidName":
    "Въведете показвано име от 1 до 100 символа, без контролни символи и ъглови скоби.",
  "signup.invalidEmail": "Въведете валиден имейл адрес.",
  "signup.invalidPassword": "Използвайте парола от 8 до 128 символа.",
  "signup.mismatch": "Паролите не съвпадат.",
  "signup.limited": "Твърде много заявки. Изчакайте, преди да опитате отново.",
  "signup.unavailable":
    "Регистрацията временно не е достъпна. Опитайте отново по-късно.",
  "signup.failed":
    "Заявката не можа да бъде завършена. Проверете данните и опитайте отново.",
} satisfies Record<keyof typeof SIGNUP_EN_MESSAGES, string>;
