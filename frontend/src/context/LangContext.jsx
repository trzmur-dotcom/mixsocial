import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    // Nav
    home: 'Home', explore: 'Explore', recipes: 'Recipes', profile: 'Profile',
    // Feed
    yourStory: 'Your Cocktail',
    pairsWith: 'Pairs with:',
    save: 'Save', saved: 'Saved',
    views: 'views',
    // Story viewer
    viewFullRecipe: 'View Full Recipe',
    saveToRecipeBook: 'Save to Recipe Book',
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    snackPairing: 'Snack Pairing',
    rateCocktail: 'Rate this cocktail',
    howMuchLoved: 'How much did you love it?',
    skipRating: 'Skip rating',
    // Recipe book
    recipeBook: 'Recipe Book',
    myBar: 'My Bar',
    manageMyBar: 'Manage My Bar',
    showingBarRecipes: '✓ Showing recipes I can make',
    filterByBar: "Filter by what's in my bar",
    sortBy: 'Sort:',
    recentlySaved: 'Recently saved',
    highestRated: 'Highest rated',
    noRecipesEmpty: 'Your recipe book is empty',
    noRecipesFilter: 'No recipes for this filter',
    startSaving: 'Save cocktails from the feed to build your collection',
    viewRecipe: 'View recipe',
    remove: 'Remove',
    rate: 'Rate',
    spirits: 'spirits',
    // Profile
    followers: 'Followers', following: 'Following',
    editBio: 'Edit bio', addBio: '+ Add bio',
    follow: 'Follow', following_btn: 'Following',
    savedRecipesCount: 'Recipes',
    // Upload
    newStory: 'New Cocktail Story',
    stepBasic: 'Step 1 of 3 — Basic info',
    stepRecipe: 'Step 2 of 3 — Recipe',
    stepFinish: 'Step 3 of 3 — Finishing touches',
    addPhoto: 'Add photo (optional)',
    cocktailName: 'Cocktail name *',
    description: 'Description...',
    difficulty: 'Difficulty', prepTime: 'Prep time (min)',
    alcoholTypes: 'Alcohol types *',
    easy: 'Easy', medium: 'Medium', hard: 'Hard',
    addIngredient: '+ Add ingredient', addStep: '+ Add step',
    foodPairing: '🍽️ Food Pairing Recommendation',
    foodPairingHint: 'What tastes great with this cocktail?',
    shareBtn: '🚀 Share Cocktail',
    next: 'Next →', back: '← Back',
    // My bar
    myBarTitle: 'My Bar',
    myBarHint: "Tell us what's in your bar — we'll show you cocktails you can make right now 🍹",
    saveBar: 'Save My Bar',
    // Explore
    searchPlaceholder: 'Search cocktails...',
    popular: 'Popular cocktails',
    noResults: 'No cocktails found',
    // Profile / RecipeBook extras
    cancel: 'Cancel',
    noMatchesBar: 'No matches in your bar',
    addMoreSpirits: 'Add more spirits to your bar or save recipes with those alcohol types',
    noRecipesProfileMe: 'Start saving cocktails to build your recipe book!',
    noRecipesProfileOther: 'No saved recipes yet',
    noTypeRecipes: 'No {type} cocktails saved yet',
    ingredient: 'Ingredient',
    posting: '🍹 Posting...',
    foodPairingPlaceholder: 'What tastes great with this cocktail? e.g. Dark chocolate, grilled shrimp, cheese board...',
    step: 'Step',
    // Login
    signIn: 'Sign In', signUp: 'Sign Up',
    email: 'Email', password: 'Password', username: 'Username',
    createAccount: 'Create Account',
    tagline: 'The cocktail community',
    forgotPassword: 'Forgot password?',
    resetPassword: 'Reset password',
    enterEmailToReset: 'Enter the email of the account you want to reset',
    sendResetLink: 'Continue',
    backToLogin: '← Back to sign in',
    newPassword: 'New password',
    confirmReset: 'Reset password',
    resetSuccess: 'Password updated. You can now sign in.',
    resetLinkReady: 'If an account exists with this email, you can set a new password below:',
    setNewPassword: 'Set a new password',
    expiresIn: 'Expires in',
    minutes: 'minutes',
    // Difficulty labels
    diff_easy: 'easy', diff_medium: 'medium', diff_hard: 'hard',
    // All filter
    all: 'All',
  },
  he: {
    // Nav
    home: 'בית', explore: 'גלה', recipes: 'מתכונים', profile: 'פרופיל',
    // Feed
    yourStory: 'הקוקטיל שלך',
    pairsWith: 'משתלב עם:',
    save: 'שמור', saved: 'נשמר',
    views: 'צפיות',
    // Story viewer
    viewFullRecipe: '📋 צפה במתכון המלא',
    saveToRecipeBook: 'שמור לספר המתכונים',
    ingredients: 'מצרכים',
    instructions: 'הוראות הכנה',
    snackPairing: 'המלצת נשנוש',
    rateCocktail: 'דרג את הקוקטייל',
    howMuchLoved: 'כמה אהבת אותו?',
    skipRating: 'דלג על הדירוג',
    // Recipe book
    recipeBook: 'ספר מתכונים',
    myBar: 'הבר שלי',
    manageMyBar: 'נהל את הבר שלי',
    showingBarRecipes: '✓ מציג מתכונים שאני יכול להכין',
    filterByBar: 'סנן לפי מה שיש לי בבית',
    sortBy: 'מיין:',
    recentlySaved: 'נשמר לאחרונה',
    highestRated: 'דירוג גבוה',
    noRecipesEmpty: 'ספר המתכונים שלך ריק',
    noRecipesFilter: 'אין מתכונים לפילטר זה',
    startSaving: 'שמור קוקטיילים מהפיד כדי לבנות את האוסף שלך',
    viewRecipe: 'צפה במתכון',
    remove: 'הסר',
    rate: 'דרג',
    spirits: 'משקאות',
    // Profile
    followers: 'עוקבים', following: 'עוקב אחרי',
    editBio: 'ערוך ביו', addBio: '+ הוסף ביו',
    follow: 'עקוב', following_btn: 'עוקב',
    savedRecipesCount: 'מתכונים',
    // Upload
    newStory: 'סטורי קוקטייל חדש',
    stepBasic: 'שלב 1 מתוך 3 — מידע בסיסי',
    stepRecipe: 'שלב 2 מתוך 3 — מתכון',
    stepFinish: 'שלב 3 מתוך 3 — גמר',
    addPhoto: 'הוסף תמונה (אופציונלי)',
    cocktailName: 'שם הקוקטייל *',
    description: 'תיאור...',
    difficulty: 'רמת קושי', prepTime: 'זמן הכנה (דק׳)',
    alcoholTypes: 'סוגי אלכוהול *',
    easy: 'קל', medium: 'בינוני', hard: 'קשה',
    addIngredient: '+ הוסף מצרך', addStep: '+ הוסף שלב',
    foodPairing: '🍽️ המלצת אוכל',
    foodPairingHint: 'מה טעים לנשנש עם הקוקטייל?',
    shareBtn: '🚀 שתף קוקטייל',
    next: 'הבא →', back: '→ חזרה',
    // My bar
    myBarTitle: 'הבר שלי',
    myBarHint: 'ספר לנו מה יש לך בבר ונציג לך קוקטיילים שאתה יכול להכין עכשיו 🍹',
    saveBar: 'שמור את הבר שלי',
    // Explore
    searchPlaceholder: 'חפש קוקטיילים...',
    popular: 'קוקטיילים פופולריים',
    noResults: 'לא נמצאו קוקטיילים',
    // Profile / RecipeBook extras
    cancel: 'ביטול',
    noMatchesBar: 'אין התאמות בבר שלך',
    addMoreSpirits: 'הוסף עוד משקאות לבר שלך או שמור מתכונים עם אותם סוגי אלכוהול',
    noRecipesProfileMe: 'התחל לשמור קוקטיילים לספר המתכונים שלך!',
    noRecipesProfileOther: 'אין מתכונים שמורים עדיין',
    noTypeRecipes: 'אין קוקטיילי {type} שמורים עדיין',
    ingredient: 'מצרך',
    posting: '🍹 מפרסם...',
    foodPairingPlaceholder: 'מה טעים עם הקוקטייל הזה? לדוגמה: שוקולד מריר, שרימפס, לוח גבינות...',
    step: 'שלב',
    // Login
    signIn: 'כניסה', signUp: 'הרשמה',
    email: 'אימייל', password: 'סיסמה', username: 'שם משתמש',
    createAccount: 'צור חשבון',
    tagline: 'קהילת הקוקטיילים',
    forgotPassword: 'שכחת סיסמה?',
    resetPassword: 'איפוס סיסמה',
    enterEmailToReset: 'הזן את האימייל של החשבון שברצונך לאפס',
    sendResetLink: 'המשך',
    backToLogin: '← חזרה לכניסה',
    newPassword: 'סיסמה חדשה',
    confirmReset: 'אפס סיסמה',
    resetSuccess: 'הסיסמה עודכנה. תוכל להיכנס כעת.',
    resetLinkReady: 'אם קיים חשבון עם אימייל זה, ניתן להגדיר סיסמה חדשה כאן:',
    setNewPassword: 'בחר סיסמה חדשה',
    expiresIn: 'יפוג בעוד',
    minutes: 'דקות',
    // Difficulty labels
    diff_easy: 'קל', diff_medium: 'בינוני', diff_hard: 'קשה',
    // All filter
    all: 'הכל',
  },
};

const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key) => translations[lang][key] ?? translations['en'][key] ?? key;
  const toggle = () => setLang(l => l === 'en' ? 'he' : 'en');
  const isRTL = lang === 'he';

  return (
    <LangContext.Provider value={{ lang, t, toggle, isRTL }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
