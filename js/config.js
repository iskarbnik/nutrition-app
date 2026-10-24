// הגדרות שמשתנות לעיתים: שמות מודלים של AI
(function (root) {
  const Config = {
    AI_MODELS: {
      gemini: 'gemini-3.8-flash',
      claude: 'claude-sonnet-5-5',
    },
  };
  if (typeof module !== 'undefined') module.exports = Config;
  else root.Config = Config;
})(this);
