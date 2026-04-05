const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: '8 to 64 characters',
    test: (password) => password.length >= 8 && password.length <= 64,
  },
  {
    id: 'uppercase',
    label: 'At least one uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase',
    label: 'At least one lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: 'At least one number',
    test: (password) => /\d/.test(password),
  },
  {
    id: 'special',
    label: 'At least one special character',
    test: (password) => SPECIAL_CHAR_REGEX.test(password),
  },
  {
    id: 'no-spaces',
    label: 'No spaces',
    test: (password) => !/\s/.test(password),
  },
];

export const getPasswordValidation = (password) => {
  const results = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(password),
  }));

  return {
    rules: results,
    isValid: results.every((rule) => rule.passed),
  };
};
