// הגדרות שמשתנות לעיתים: שמות מודלים של AI
(function (root) {
  const Config = {
    AI_MODELS: {
      gemini: 'gemini-3.8-flash',
      claude: 'claude-sonnet-5-5',
    },
    // תקרה לתשובה של Gemini, כולל טוקני חשיבה, כדי שתשובה שרצה בלי סוף לא תאכל את המכסה
    GEMINI_MAX_OUTPUT: 4096,
    GEMINI_THINKING: 'LOW',
    // מזהה הלקוח מ-Google Cloud. ההסבר ב-docs/google-setup.md
    GOOGLE_CLIENT_ID: '1092508027930-1gr51u93tsobal2r9hcddi5no0ltvdda.apps.googleusercontent.com',
  };
  if (typeof module !== 'undefined') module.exports = Config;
  else root.Config = Config;
})(this);
