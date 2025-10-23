import { DebridOptions } from '../moch/options.js';
import { QualityFilter, Providers, SizeFilter } from './filter.js';
import { LanguageOptions } from './languages.js';

export const PreConfigurations = {
  lite: {
    config: liteConfig(),
    serialized: configValue(liteConfig()),
    manifest: {
      id: 'org.stremio.kj-torrentio.lite',
      name: 'KJ Torrentio Lite',
      description:
        'Preconfigured lightweight version of KJ-Torrentio-Scraper.\n' +
        'For full customization visit https://kj-torrentio-scraper.onrender.com/lite/configure',
      logo: 'https://kj-torrentio-scraper.onrender.com/images/logo_v1.png',
    },
  },
  brazuca: {
    config: brazucaConfig(),
    serialized: configValue(brazucaConfig()),
    manifest: {
      id: 'org.stremio.kj-torrentio.brazuca',
      name: 'KJ Torrentio Brazuca',
      description:
        'Preconfigured version of KJ-Torrentio-Scraper for Brazilian/Portuguese content.\n' +
        'For full customization visit https://kj-torrentio-scraper.onrender.com/brazuca/configure',
      logo: 'https://kj-torrentio-scraper.onrender.com/images/logo_v1.png',
    },
  },
};

const keysToSplit = [
  Providers.key,
  LanguageOptions.key,
  QualityFilter.key,
  SizeFilter.key,
  DebridOptions.key,
];
const keysToUppercase = [SizeFilter.key];

export function parseConfiguration(configuration) {
  if (!configuration) return undefined;

  if (PreConfigurations[configuration]) {
    return PreConfigurations[configuration].config;
  }

  const configValues = configuration.split('|').reduce((map, next) => {
    const [key, value] = next.split('=');
    if (key && value) map[key.toLowerCase()] = value;
    return map;
  }, {});

  keysToSplit
    .filter((key) => configValues[key])
    .forEach(
      (key) =>
        (configValues[key] = configValues[key]
          .split(',')
          .map((value) =>
            keysToUppercase.includes(key)
              ? value.toUpperCase()
              : value.toLowerCase()
          ))
    );

  return configValues;
}

function liteConfig() {
  const config = {};
  config[Providers.key] = Providers.options
    .filter((provider) => !provider.foreign)
    .map((provider) => provider.key);
  config[QualityFilter.key] = ['scr', 'cam'];
  config['limit'] = 1;
  return config;
}

function brazucaConfig() {
  const config = {};
  config[Providers.key] = Providers.options
    .filter((provider) => !provider.foreign || provider.foreign === '🇵🇹')
    .map((provider) => provider.key);
  config[LanguageOptions.key] = ['portuguese'];
  return config;
}

function configValue(config) {
  return Object.entries(config)
    .map(([key, value]) =>
      Array.isArray(value) ? `${key}=${value.join(',')}` : `${key}=${value}`
    )
    .join('|');
}

export function getManifestOverride(config) {
  const preConfig = Object.values(PreConfigurations).find(
    (pre) => pre.config === config
  );
  return preConfig ? preConfig.manifest : {};
}
