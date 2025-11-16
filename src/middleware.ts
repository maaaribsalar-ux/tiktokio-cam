// ============================================
// FILE 1: src/middleware.ts
// ============================================
import { defineMiddleware } from 'astro:middleware';

// Your supported locales from astro.config.mjs
const supportedLocales = [
  'en', 'it', 'vi', 'ar', 'fr', 'de', 'es', 
  'hi', 'id', 'ru', 'pt', 'ko', 'tl', 'nl', 'ms', 'tr'
];

const defaultLocale = 'en';

// Map countries to locales - targeting your key markets
const countryToLocale: Record<string, string> = {
  // Indonesia (highest priority for your use case)
  'ID': 'id',
  
  // Vietnam
  'VN': 'vi',
  
  // India
  'IN': 'hi',
  
  // Philippines (Tagalog)
  'PH': 'tl',
  
  // Malaysia (Malay)
  'MY': 'ms',
  
  // Arabic-speaking countries
  'SA': 'ar', 'AE': 'ar', 'EG': 'ar', 'MA': 'ar', 
  'DZ': 'ar', 'IQ': 'ar', 'JO': 'ar', 'KW': 'ar',
  'LB': 'ar', 'OM': 'ar', 'QA': 'ar', 'SY': 'ar',
  'YE': 'ar', 'BH': 'ar', 'TN': 'ar', 'LY': 'ar',
  
  // Spanish-speaking countries
  'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es',
  'CL': 'es', 'PE': 'es', 'VE': 'es', 'EC': 'es',
  'GT': 'es', 'CU': 'es', 'BO': 'es', 'DO': 'es',
  'HN': 'es', 'PY': 'es', 'SV': 'es', 'NI': 'es',
  'CR': 'es', 'PA': 'es', 'UY': 'es',
  
  // French-speaking countries
  'FR': 'fr', 'BE': 'fr', 'CH': 'fr', 'CA': 'fr',
  'LU': 'fr', 'MC': 'fr', 'CI': 'fr', 'CM': 'fr',
  'CD': 'fr', 'MG': 'fr', 'SN': 'fr', 'ML': 'fr',
  
  // Portuguese-speaking countries
  'PT': 'pt', 'BR': 'pt', 'AO': 'pt', 'MZ': 'pt',
  
  // German-speaking countries
  'DE': 'de', 'AT': 'de', 'CH': 'de', 'LI': 'de',
  
  // Italian
  'IT': 'it', 'SM': 'it', 'VA': 'it',
  
  // Korean
  'KR': 'ko',
  
  // Dutch
  'NL': 'nl', 'BE': 'nl', 'SR': 'nl',
  
  // Russian
  'RU': 'ru', 'BY': 'ru', 'KZ': 'ru', 'KG': 'ru',
  
  // Turkish
  'TR': 'tr', 'CY': 'tr',
};

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  
  // Skip API routes, static files, admin, and special files
  if (
    pathname.startsWith('/api/') || 
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/_') ||
    pathname.match(/\.(js|css|png|jpg|jpeg|webp|svg|ico|json|xml|txt|avif|woff|woff2|ttf|eot)$/) ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/ads.txt' ||
    pathname.includes('/rss.xml')
  ) {
    return next();
  }
  
  // Parse the path to check for locale
  const pathSegments = pathname.split('/').filter(Boolean);
  const firstSegment = pathSegments[0] || '';
  
  // Check if path already has a locale (but not 'en' since it's not prefixed)
  const nonDefaultLocales = supportedLocales.filter(l => l !== defaultLocale);
  const hasLocale = nonDefaultLocales.includes(firstSegment);
  
  // Only redirect if:
  // 1. On root path (/)
  // 2. On a path without locale prefix and not a special page
  if (!hasLocale && (pathname === '/' || !nonDefaultLocales.some(l => pathname.startsWith(`/${l}/`)))) {
    let detectedLocale = defaultLocale;
    let shouldRedirect = false;
    
    // Priority 1: Check user's saved preference cookie
    const localeCookie = context.cookies.get('user-locale')?.value;
    if (localeCookie && supportedLocales.includes(localeCookie)) {
      detectedLocale = localeCookie;
      // Always redirect if cookie is set and not default
      if (detectedLocale !== defaultLocale) {
        shouldRedirect = true;
      }
    } else {
      // Priority 2: Check country header (Cloudflare, Vercel, Netlify, etc.)
      const cfCountry = context.request.headers.get('cf-ipcountry') || 
                       context.request.headers.get('x-vercel-ip-country') ||
                       context.request.headers.get('x-country-code');
      
      if (cfCountry && countryToLocale[cfCountry]) {
        detectedLocale = countryToLocale[cfCountry];
        shouldRedirect = true;
      } else {
        // Priority 3: Check Accept-Language header from browser
        const acceptLanguage = context.request.headers.get('accept-language');
        if (acceptLanguage) {
          // Parse accept-language: "id-ID,id;q=0.9,en;q=0.8"
          const languages = acceptLanguage
            .split(',')
            .map(lang => {
              const [locale, q = 'q=1'] = lang.trim().split(';');
              const quality = parseFloat(q.replace('q=', '') || '1');
              // Get just the language code (id from id-ID)
              const langCode = locale.split('-')[0].toLowerCase();
              return { locale: langCode, quality };
            })
            .sort((a, b) => b.quality - a.quality);
          
          // Find first matching supported locale
          for (const { locale } of languages) {
            if (supportedLocales.includes(locale) && locale !== defaultLocale) {
              detectedLocale = locale;
              shouldRedirect = true;
              break;
            }
          }
        }
      }
    }
    
    // Redirect to localized URL if needed
    // Note: English (default) doesn't need prefix due to prefixDefaultLocale: false
    if (shouldRedirect && detectedLocale !== defaultLocale) {
      const newPath = `/${detectedLocale}${pathname}${url.search}`;
      return context.redirect(newPath, 302);
    }
  }
  
  return next();
});

