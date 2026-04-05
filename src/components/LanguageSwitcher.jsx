import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center mt-4 gap-2 px-3 py-2 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all duration-200 font-semibold text-sm text-zinc-900 dark:text-zinc-100"
      aria-label="Change language"
    >
      <Languages className="w-4 h-4" />
      <span className="uppercase">{i18n.language}</span>
    </button>
  );
}
