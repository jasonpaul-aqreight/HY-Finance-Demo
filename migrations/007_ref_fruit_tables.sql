-- ============================================================================
-- 007_ref_fruit_tables.sql — Fruit reference / lookup tables
-- Reconstructed from AutoCount UDF_BoC field (918 unique combos) plus
-- description-parsing of 2,737 active unclassified items.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- REF_FRUITS — Standardized fruit / product category names
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_fruits (
    name TEXT PRIMARY KEY
);

INSERT INTO ref_fruits (name) VALUES
    ('APPLE'),
    ('APRICOT'),
    ('AVOCADO'),
    ('BANANA'),
    ('BAYBERRY'),
    ('BISCUIT'),
    ('BLACKBERRY'),
    ('BLUEBERRY'),
    ('BUDDHA''S HAND'),
    ('CARROT'),
    ('CEMPEDAK'),
    ('CHERRY'),
    ('CHESTNUT'),
    ('CHIKU'),
    ('CHILLI'),
    ('COCONUT'),
    ('CUSTARD APPLE'),
    ('DATES'),
    ('DOKONG'),
    ('DRAGON FRUITS'),
    ('DRY FRUITS'),
    ('DUKU LANGSAT'),
    ('DURIAN'),
    ('FATT CHOI'),
    ('FIG'),
    ('GARLIC'),
    ('GINKGO NUT'),
    ('GRAPEFRUIT'),
    ('GRAPES'),
    ('GUAVA'),
    ('HONEYDEW'),
    ('HU LU'),
    ('JACKFRUIT'),
    ('JUICES'),
    ('KAMQUAT'),
    ('KEDONDONG'),
    ('KIWI'),
    ('KUNDANG'),
    ('LEMON'),
    ('LIME'),
    ('LONGAN'),
    ('LONGKONG'),
    ('LYCHEE'),
    ('MANDARIN'),
    ('MANGO'),
    ('MANGOSTEEN'),
    ('MELON'),
    ('MIXED'),
    ('NECTARINE'),
    ('ORANGE'),
    ('OTHERS'),
    ('PAPAYA'),
    ('PAPPLE'),
    ('PASSION FRUIT'),
    ('PEACH'),
    ('PEAR'),
    ('PERSIMMON'),
    ('PINEAPPLE'),
    ('PLUM'),
    ('POMEGRANATE'),
    ('POMELO'),
    ('POTATO'),
    ('PRUNES'),
    ('PUMPKIN'),
    ('RAMBAI'),
    ('RAMBUTAN'),
    ('RASPBERRY'),
    ('RICE'),
    ('SALAK'),
    ('SAPODILLA'),
    ('SOURSOP'),
    ('STAR FRUIT'),
    ('STRAWBERRY'),
    ('SWEET POTATO'),
    ('VEGETABLES'),
    ('WAXBERRY')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- REF_COUNTRIES — Country names with abbreviations
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_countries (
    name         TEXT PRIMARY KEY,
    abbreviation TEXT
);

INSERT INTO ref_countries (name, abbreviation) VALUES
    ('ALGERIA',              'DZ'),
    ('ARGENTINA',            'AR'),
    ('AUSTRALIA',            'AU'),
    ('AZERBAIJIAN',          'AZ'),
    ('BELGIUM',              'BE'),
    ('BRAZIL',               'BR'),
    ('BRUNEI',               'BN'),
    ('CANADA',               'CA'),
    ('CHILE',                'CL'),
    ('CHINA',                'CN'),
    ('CYPRUS',                'CY'),
    ('ECUADOR',              'EC'),
    ('EGYPT',                'EG'),
    ('ETHIOPIA',             'ET'),
    ('FRANCE',               'FR'),
    ('GEORGIA',              'GE'),
    ('GERMANY',              'DE'),
    ('GREECE',               'GR'),
    ('HONG KONG',            'HK'),
    ('INDIA',                'IN'),
    ('INDONESIA',            'ID'),
    ('IRAN',                 'IR'),
    ('ITALY',                'IT'),
    ('JAPAN',                'JP'),
    ('JORDAN',               'JO'),
    ('KENYA',                'KE'),
    ('KOREA',                'KR'),
    ('LEBANON',              'LB'),
    ('LOCAL',                'MY'),
    ('MEXICO',               'MX'),
    ('MOROCCO',              'MA'),
    ('NETHERLANDS',          'NL'),
    ('NEW ZEALAND',          'NZ'),
    ('OTHERS',               'OT'),
    ('PAKISTAN',              'PK'),
    ('PALESTINE',            'PS'),
    ('PERU',                 'PE'),
    ('PHILIPPINES',          'PH'),
    ('POLAND',               'PL'),
    ('PORTUGAL',             'PT'),
    ('SAUDI ARABIA',         'SA'),
    ('SERBIA',               'RS'),
    ('SOUTH AFRICA',         'ZA'),
    ('SPAIN',                'ES'),
    ('SYRIA',                'SY'),
    ('TAIWAN',               'TW'),
    ('THAILAND',             'TH'),
    ('TUNISIA',              'TN'),
    ('TURKEY',               'TR'),
    ('UKRAINE',              'UA'),
    ('UNITED ARAB EMIRATES', 'AE'),
    ('UNITED STATES',        'US'),
    ('UZBEKISTAN',           'UZ'),
    ('VIETNAM',              'VN'),
    ('ZAMBIA',               'ZM'),
    ('ZIMBABWE',             'ZW')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- REF_FRUIT_ALIASES — Maps alternate spellings / plurals → canonical name
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_fruit_aliases (
    alias         TEXT PRIMARY KEY,
    standard_name TEXT NOT NULL REFERENCES ref_fruits (name)
);

INSERT INTO ref_fruit_aliases (alias, standard_name) VALUES
    ('APRICORT',      'APRICOT'),
    ('APRICOTS',      'APRICOT'),
    ('BLACKBERRIES',  'BLACKBERRY'),
    ('BLUEBERRIES',   'BLUEBERRY'),
    ('CHERRIES',      'CHERRY'),
    ('FIGS',          'FIG'),
    ('GRAPE',         'GRAPES'),
    ('GRAPEFRUITS',   'GRAPEFRUIT'),
    ('KIWIFRUIT',     'KIWI'),
    ('LEMONS',        'LEMON'),
    ('LIMES',         'LIME'),
    ('MANGOES',       'MANGO'),
    ('ORANGES',       'ORANGE'),
    ('PEACHES',       'PEACH'),
    ('PEARS',         'PEAR'),
    ('PERSIMMONS',    'PERSIMMON'),
    ('PLUMS',         'PLUM'),
    ('POMEGRANATES',  'POMEGRANATE'),
    ('POMELOS',       'POMELO'),
    ('POTATOES',      'POTATO'),
    ('RASPBERRIES',   'RASPBERRY'),
    ('SAPODILLA',     'SAPODILLA'),
    ('STRAWBERRIES',  'STRAWBERRY'),
    ('DRAGON FRUIT',  'DRAGON FRUITS'),
    ('DRAGONFRUIT',   'DRAGON FRUITS'),
    ('DRAGONFRUITS',  'DRAGON FRUITS'),
    ('DRIED FRUITS',  'DRY FRUITS'),
    ('DRIED FRUIT',   'DRY FRUITS'),
    ('PASSION FRUITS','PASSION FRUIT'),
    ('STARFRUIT',     'STAR FRUIT'),
    ('NANAS',         'PINEAPPLE'),
    ('DURIAN BELANDA','SOURSOP'),
    ('SNAKE FRUIT',   'SALAK'),
    ('JAMBU BATU',    'GUAVA'),
    ('MANGGIS',       'MANGOSTEEN'),
    ('NANGKA',        'JACKFRUIT'),
    ('PLUM MANGO',    'KUNDANG'),
    ('DELIMA',        'POMEGRANATE'),
    ('GUAVASTEEN',    'GUAVA')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- REF_COUNTRY_ALIASES — Maps alternate country names / abbreviations used
-- in item descriptions → canonical country name
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_country_aliases (
    alias         TEXT PRIMARY KEY,
    standard_name TEXT NOT NULL REFERENCES ref_countries (name)
);

INSERT INTO ref_country_aliases (alias, standard_name) VALUES
    ('SA',    'SOUTH AFRICA'),
    ('US',    'UNITED STATES'),
    ('USA',   'UNITED STATES'),
    ('NZ',    'NEW ZEALAND'),
    ('UAE',   'UNITED ARAB EMIRATES'),
    ('HK',    'HONG KONG'),
    ('CN',    'CHINA'),
    ('AU',    'AUSTRALIA'),
    ('JP',    'JAPAN'),
    ('KR',    'KOREA'),
    ('TH',    'THAILAND'),
    ('VN',    'VIETNAM'),
    ('MY',    'LOCAL'),
    ('MALAYSIA', 'LOCAL')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- REF_FRUIT_VARIANTS — Known fruit + variant combinations
-- Source: 918 UDF_BoC entries + description-parsed variants
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_fruit_variants (
    fruit   TEXT NOT NULL REFERENCES ref_fruits (name),
    variant TEXT NOT NULL,
    PRIMARY KEY (fruit, variant)
);

INSERT INTO ref_fruit_variants (fruit, variant) VALUES
    -- APPLE (47 from UDF_BoC + extras from descriptions)
    ('APPLE', 'AMBROSIA'),
    ('APPLE', 'BIGBUCKS'),
    ('APPLE', 'BINGO GALA'),
    ('APPLE', 'BLUSH FUJI'),
    ('APPLE', 'BRAEBURN'),
    ('APPLE', 'BREEZE'),
    ('APPLE', 'CANDY APPLE'),
    ('APPLE', 'CARMINE'),
    ('APPLE', 'CHERRY APPLE'),
    ('APPLE', 'CREAM'),
    ('APPLE', 'CRIPPS PINK'),
    ('APPLE', 'CRIPPS RED'),
    ('APPLE', 'DAZZLE'),
    ('APPLE', 'DIVA'),
    ('APPLE', 'DIVINE'),
    ('APPLE', 'DOUBLE RED FUJI'),
    ('APPLE', 'EARLY QUEEN'),
    ('APPLE', 'EMERGO'),
    ('APPLE', 'ENVY'),
    ('APPLE', 'FUJI'),
    ('APPLE', 'FUJI DOUBLE RED'),
    ('APPLE', 'FUJI RED'),
    ('APPLE', 'GALA'),
    ('APPLE', 'GOLDEN APPLE'),
    ('APPLE', 'GRANNY SMITH'),
    ('APPLE', 'HONEY FUJI'),
    ('APPLE', 'HONEY FUJI RED'),
    ('APPLE', 'HONEY RED FUJI'),
    ('APPLE', 'HONEY SWEET'),
    ('APPLE', 'JAZZ'),
    ('APPLE', 'JINXIN'),
    ('APPLE', 'JONAPRINCE'),
    ('APPLE', 'JULIET'),
    ('APPLE', 'KANZI'),
    ('APPLE', 'LADY'),
    ('APPLE', 'MINI APPLE'),
    ('APPLE', 'MODI'),
    ('APPLE', 'MOLDOVA'),
    ('APPLE', 'PACIFIC ROSE'),
    ('APPLE', 'PINK LADY'),
    ('APPLE', 'PRINCE'),
    ('APPLE', 'QUEEN'),
    ('APPLE', 'RED APPLES'),
    ('APPLE', 'RED DELICIOUS'),
    ('APPLE', 'RED STAR'),
    ('APPLE', 'ROCKIT'),
    ('APPLE', 'ROME'),
    ('APPLE', 'ROSE'),
    ('APPLE', 'ROSE APPLE'),
    ('APPLE', 'ROSE ORGANIC'),
    ('APPLE', 'ROYAL BEAUTY'),
    ('APPLE', 'ROYAL FUJI'),
    ('APPLE', 'ROYAL GALA'),
    ('APPLE', 'ROYAL RED GALA'),
    ('APPLE', 'SEKAIICHI'),
    ('APPLE', 'SNAP DRAGON'),
    ('APPLE', 'SOLUNA'),
    ('APPLE', 'STRAWBERRY APPLE'),
    ('APPLE', 'WANG LIN'),
    ('APPLE', 'YU LIN'),

    -- APRICOT
    ('APRICOT', 'MIDNIGHT APRICOT'),
    ('APRICOT', 'OTHERS'),
    ('APRICOT', 'SUGAR APRICOT'),

    -- AVOCADO
    ('AVOCADO', 'COCKTAIL'),
    ('AVOCADO', 'HASS'),
    ('AVOCADO', 'OTHERS'),
    ('AVOCADO', 'SHEPARD'),

    -- BANANA
    ('BANANA', 'BARANGAN'),
    ('BANANA', 'CAVENDISH'),
    ('BANANA', 'EMAS'),
    ('BANANA', 'MONTEL'),
    ('BANANA', 'RASTALI'),
    ('BANANA', 'SUSU'),

    -- BAYBERRY
    ('BAYBERRY', 'OTHERS'),

    -- BISCUIT
    ('BISCUIT', 'OTHERS'),

    -- BLACKBERRY
    ('BLACKBERRY', 'OTHERS'),

    -- BLUEBERRY
    ('BLUEBERRY', 'JUMBO'),
    ('BLUEBERRY', 'OTHERS'),

    -- CARROT
    ('CARROT', 'BABY CARROT'),
    ('CARROT', 'OTHERS'),
    ('CARROT', 'PURPLE CARROT'),

    -- CEMPEDAK
    ('CEMPEDAK', 'OTHERS'),

    -- CHERRY
    ('CHERRY', 'LAPIN'),
    ('CHERRY', 'OTHERS'),
    ('CHERRY', 'RED CHERRY'),
    ('CHERRY', 'REGINA'),
    ('CHERRY', 'ROYAL TIOGA'),
    ('CHERRY', 'SAMBA'),
    ('CHERRY', 'SKEENA'),
    ('CHERRY', 'STACCATO'),
    ('CHERRY', 'SWEET GEORGIA'),
    ('CHERRY', 'SWEET HEART'),
    ('CHERRY', 'SYLVIA'),
    ('CHERRY', 'TAMARA'),
    ('CHERRY', 'WHITE CHERRY'),

    -- CHESTNUT
    ('CHESTNUT', 'OTHERS'),

    -- CHIKU
    ('CHIKU', 'OTHERS'),
    ('CHIKU', 'SAPODILLA'),

    -- CHILLI
    ('CHILLI', 'OTHERS'),

    -- COCONUT
    ('COCONUT', 'COCONUT JELLY'),
    ('COCONUT', 'FRAGANT COCONUT'),
    ('COCONUT', 'OTHERS'),

    -- CUSTARD APPLE
    ('CUSTARD APPLE', 'OTHERS'),

    -- DATES
    ('DATES', 'AJWA'),
    ('DATES', 'BARHI'),
    ('DATES', 'DEGLET NOUR'),
    ('DATES', 'FRESH DATES (YELLOW)'),
    ('DATES', 'GREEN DATES'),
    ('DATES', 'GREEN JUJUBE'),
    ('DATES', 'HARMONY'),
    ('DATES', 'JUJUBE'),
    ('DATES', 'LATIFEH'),
    ('DATES', 'MARYAMI'),
    ('DATES', 'MAZAFATI'),
    ('DATES', 'MEDJOOL'),
    ('DATES', 'OTHERS'),
    ('DATES', 'SEEDLES DATES'),
    ('DATES', 'WINTER DATES'),
    ('DATES', 'WINTER JUJUBE'),

    -- DOKONG
    ('DOKONG', 'OTHERS'),

    -- DRAGON FRUITS
    ('DRAGON FRUITS', '(MI) WHITE DRAGON'),
    ('DRAGON FRUITS', 'OTHERS'),
    ('DRAGON FRUITS', 'PITAHAYA'),
    ('DRAGON FRUITS', 'PITAHAYA (GOLDEN DRAGONFRUITS)'),
    ('DRAGON FRUITS', 'RED DRAGON'),
    ('DRAGON FRUITS', 'WHITE DRAGON'),
    ('DRAGON FRUITS', 'YELLOW DRAGON'),

    -- DRY FRUITS
    ('DRY FRUITS', 'APRICORT'),
    ('DRY FRUITS', 'CHEN PI'),
    ('DRY FRUITS', 'DRIED FIGS'),
    ('DRY FRUITS', 'DRIED PURPLE POTATO'),
    ('DRY FRUITS', 'DRIED YELLOW POTATO'),
    ('DRY FRUITS', 'FIGS'),
    ('DRY FRUITS', 'HE LAO TAI'),
    ('DRY FRUITS', 'MULBERRIES'),
    ('DRY FRUITS', 'OTHERS'),
    ('DRY FRUITS', 'PEANUT CHEN PI'),
    ('DRY FRUITS', 'PERSIMMON CAKE'),
    ('DRY FRUITS', 'PLUM'),
    ('DRY FRUITS', 'PRESERVED DRY PLUM'),
    ('DRY FRUITS', 'RAISIN GRAPES (BLACK)'),
    ('DRY FRUITS', 'RAISIN GRAPES (GOLD)'),
    ('DRY FRUITS', 'RAISIN GRAPES (GREEN)'),
    ('DRY FRUITS', 'RAISIN GRAPES (MIXED)'),
    ('DRY FRUITS', 'RAISIN GRAPES (RED)'),
    ('DRY FRUITS', 'ROASTED PEELED'),
    ('DRY FRUITS', 'ROASTED RINGENT'),
    ('DRY FRUITS', 'ZHU LIAN XIANG'),

    -- DUKU LANGSAT
    ('DUKU LANGSAT', 'OTHERS'),

    -- DURIAN
    ('DURIAN', 'OTHERS'),

    -- FATT CHOI
    ('FATT CHOI', 'DOUBLE'),
    ('FATT CHOI', 'OTHERS'),

    -- FIG
    ('FIG', 'OTHERS'),

    -- GARLIC
    ('GARLIC', 'OTHERS'),

    -- GINKGO NUT
    ('GINKGO NUT', 'OTHERS'),

    -- GRAPEFRUIT
    ('GRAPEFRUIT', 'GOLDEN GRAPEFRUIT'),
    ('GRAPEFRUIT', 'HONEY GRAPEFRUIT'),
    ('GRAPEFRUIT', 'OTHERS'),
    ('GRAPEFRUIT', 'RUBY STAR'),

    -- GRAPES (102+ variants — the big one!)
    ('GRAPES', 'ADORA (BLACK SEEDLESS)'),
    ('GRAPES', 'ADORA S34 (BLACK SEEDLESS)'),
    ('GRAPES', 'AFRICAN DELIGHT (RED SEEDLESS)'),
    ('GRAPES', 'ALLISON (RED SEEDLESS)'),
    ('GRAPES', 'APPLAUSE (GREEN SEEDLESS)'),
    ('GRAPES', 'ARRA10 (RED SEEDLESS)'),
    ('GRAPES', 'ARRA13 (RED SEEDLESS)'),
    ('GRAPES', 'ARRA14 (BLACK SEEDLESS)'),
    ('GRAPES', 'ARRA15 (GREEN SEEDLESS)'),
    ('GRAPES', 'ARRA18 (BLACK SEEDLESS)'),
    ('GRAPES', 'ARRA29 (RED SEEDLESS)'),
    ('GRAPES', 'AUTUMN BLACK (BLACK SEEDLESS)'),
    ('GRAPES', 'AUTUMN CRISP (GREEN SEEDLESS)'),
    ('GRAPES', 'AUTUMN KING (GREEN SEEDLESS)'),
    ('GRAPES', 'AUTUMN ROYAL (BLACK SEEDLESS)'),
    ('GRAPES', 'BLACK EMERALD (BLACK SEEDLESS)'),
    ('GRAPES', 'BLACK GLOBE'),
    ('GRAPES', 'BLACK MAGIC (BLACK SEEDLESS)'),
    ('GRAPES', 'BLACK PEARL'),
    ('GRAPES', 'BLACK SEEDLESS'),
    ('GRAPES', 'BLGEN SCARLOTTA (RED SEEDLESS)'),
    ('GRAPES', 'CALMERIA (GREEN SEEDLESS)'),
    ('GRAPES', 'CANDY CRUNCH (BLACK SEEDLESS)'),
    ('GRAPES', 'CANDY DREAM (BLACK SEEDLESS)'),
    ('GRAPES', 'CANDY HEART (RED SEEDLESS)'),
    ('GRAPES', 'CANDY SNAP (RED SEEDLESS)'),
    ('GRAPES', 'CHAMPAGNE (GREEN SEEDLESS)'),
    ('GRAPES', 'CHAMPAGNE (RED SEEDLESS)'),
    ('GRAPES', 'COTTON CANDY (GREEN SEEDLESS)'),
    ('GRAPES', 'CRIMSON (RED SEEDLESS)'),
    ('GRAPES', 'CRIMSON ORGANIC (RED SEEDLESS)'),
    ('GRAPES', 'DELAWE'),
    ('GRAPES', 'EARLY SWEET (GREEN SEEDLESS)'),
    ('GRAPES', 'ESTEEM (GREEN SEEDLESS)'),
    ('GRAPES', 'FANTASY (BLACK SEEDLESS)'),
    ('GRAPES', 'FLAME (RED SEEDLESS)'),
    ('GRAPES', 'GREAT GREEN (GREEN SEEDLESS)'),
    ('GRAPES', 'GREEN EMERALD (GREEN SEEDLESS)'),
    ('GRAPES', 'GREEN SEEDLESS'),
    ('GRAPES', 'HONEY POP'),
    ('GRAPES', 'ICON (RED SEEDLESS)'),
    ('GRAPES', 'IFG9 (RED SEEDLESS)'),
    ('GRAPES', 'ITUM V (GREEN SEEDLESS)'),
    ('GRAPES', 'IVORY (GREEN SEEDLESS)'),
    ('GRAPES', 'JACK SALUTE (BLACK SEEDLESS)'),
    ('GRAPES', 'JOYBELLS (RED SEEDLESS)'),
    ('GRAPES', 'KRISSY (RED SEEDLESS)'),
    ('GRAPES', 'KYOHO (BLACK SEEDLESS)'),
    ('GRAPES', 'LONG CRIMSON (RED SEEDLESS)'),
    ('GRAPES', 'MELODY (BLACK SEEDLESS)'),
    ('GRAPES', 'MIDNIGHT BEAUTY (BLACK SEEDLESS)'),
    ('GRAPES', 'MIXED BLACK AND GREEN SEEDLESS'),
    ('GRAPES', 'MIXED RED AND BLACK SEEDLESS'),
    ('GRAPES', 'MIXED RED AND GREEN SEEDLESS'),
    ('GRAPES', 'MOONDROP (BLACK SEEDLESS)'),
    ('GRAPES', 'MOUNTAIN PEARL RED (RED SEEDLESS)'),
    ('GRAPES', 'MYSTIC STAR (BLACK SEEDLESS)'),
    ('GRAPES', 'PASSION FIRE (RED SEEDLESS)'),
    ('GRAPES', 'PRIME (GREEN SEEDLESS)'),
    ('GRAPES', 'PRINCESS (GREEN SEEDLESS)'),
    ('GRAPES', 'PRISTINE (GREEN SEEDLESS)'),
    ('GRAPES', 'QUEEN NINA (RED SEEDLESS)'),
    ('GRAPES', 'RALLI (RED SEEDLESS)'),
    ('GRAPES', 'RED EMERALD (RED SEEDLESS)'),
    ('GRAPES', 'RED GLOBE'),
    ('GRAPES', 'RED SEEDLESS'),
    ('GRAPES', 'REGAL (GREEN SEEDLESS)'),
    ('GRAPES', 'SABLE (BLACK SEEDLESS)'),
    ('GRAPES', 'SCARLET ROYAL (RED SEEDLESS)'),
    ('GRAPES', 'SCARLOTTA (RED SEEDLESS)'),
    ('GRAPES', 'SGS (RED SEEDLESS)'),
    ('GRAPES', 'SHARAD (BLACK SEEDLESS)'),
    ('GRAPES', 'SHINE MUSCAT (GREEN SEEDLESS)'),
    ('GRAPES', 'SONAKA (GREEN SEEDLESS)'),
    ('GRAPES', 'SONERA (RED SEEDLESS)'),
    ('GRAPES', 'STARLIGHT (RED SEEDLESS)'),
    ('GRAPES', 'STELLA BELLA (GREEN SEEDLESS)'),
    ('GRAPES', 'STELLA BELLA ORGANIC (GREEN SEEDLESS)'),
    ('GRAPES', 'SUGAR CRISP (GREEN SEEDLESS)'),
    ('GRAPES', 'SUGAR CRUNCH (GREEN SEEDLESS)'),
    ('GRAPES', 'SUGAR DROP (GREEN SEEDLESS)'),
    ('GRAPES', 'SUGARNINETEEN S19 (RED SEEDLESS)'),
    ('GRAPES', 'SUGARONE (GREEN SEEDLESS)'),
    ('GRAPES', 'SUGARTHIRHTEEN S13 (BLACK SEEDLESS)'),
    ('GRAPES', 'SUMMER BLACK (BLACK SEEDLESS)'),
    ('GRAPES', 'SUMMER CRUNCH (GREEN SEEDLESS)'),
    ('GRAPES', 'SUMMER ROYAL (BLACK SEEDLESS)'),
    ('GRAPES', 'SUPERIOR (GREEN SEEDLESS)'),
    ('GRAPES', 'SWEET CELEBRATION (RED SEEDLESS)'),
    ('GRAPES', 'SWEET GLOBE (GREEN SEEDLESS)'),
    ('GRAPES', 'SWEET HEART (RED SEEDLESS)'),
    ('GRAPES', 'SWEET JOY (BLACK SEEDLESS)'),
    ('GRAPES', 'SWEET JUBILEE (BLACK SEEDLESS)'),
    ('GRAPES', 'SWEET SCARLET (RED SEEDLESS)'),
    ('GRAPES', 'SWEET SHAPPHIER (BLACK SEEDLESS)'),
    ('GRAPES', 'SWEET SUNSHINE (GREEN SEEDLESS)'),
    ('GRAPES', 'SWEETA (GREEN SEEDLESS)'),
    ('GRAPES', 'TAWNY (RED SEEDLESS)'),
    ('GRAPES', 'THOMPSON (GREEN SEEDLESS)'),
    ('GRAPES', 'TIMCO (RED SEEDLESS)'),
    ('GRAPES', 'TIMPSON (GREEN SEEDLESS)'),
    ('GRAPES', 'UNKNOWN (BLACK SEEDLESS)'),
    ('GRAPES', 'VALLEY PEARL (GREEN SEEDLESS)'),
    ('GRAPES', 'VINTAGE (RED SEEDLESS)'),
    ('GRAPES', 'WITCH FINGER (BLACK SEEDLESS)'),

    -- GUAVA
    ('GUAVA', 'FEIJOA'),
    ('GUAVA', 'GUAVA SEEDED'),
    ('GUAVA', 'GUAVA SEEDLESS'),
    ('GUAVA', 'OTHERS'),
    ('GUAVA', 'PINK GUAVA'),

    -- HONEYDEW
    ('HONEYDEW', 'OTHERS'),

    -- JACKFRUIT
    ('JACKFRUIT', 'OTHERS'),

    -- JUICES
    ('JUICES', 'OTHERS'),

    -- KAMQUAT
    ('KAMQUAT', 'GOLD TANGERINES'),
    ('KAMQUAT', 'OTHERS'),

    -- KEDONDONG
    ('KEDONDONG', 'KEDONDONG'),

    -- KIWI
    ('KIWI', 'GOLD KIWI'),
    ('KIWI', 'GREEN KIWI'),
    ('KIWI', 'GREEN KIWI ORGANIC'),
    ('KIWI', 'KIWIBERRY'),
    ('KIWI', 'ORGANIC GOLD KIWI'),
    ('KIWI', 'RED KIWI'),
    ('KIWI', 'RUBY RED'),

    -- KUNDANG
    ('KUNDANG', 'OTHERS'),

    -- LEMON
    ('LEMON', 'EUREKA'),
    ('LEMON', 'OTHERS'),
    ('LEMON', 'TAIWAN GREEN'),

    -- LIME
    ('LIME', 'KASTURI'),
    ('LIME', 'OTHERS'),

    -- LONGAN
    ('LONGAN', 'LONGAN ORGANIC'),
    ('LONGAN', 'OTHERS'),

    -- LONGKONG
    ('LONGKONG', 'OTHERS'),

    -- LYCHEE
    ('LYCHEE', 'FEI ZI XIAO'),
    ('LYCHEE', 'JI ZUI'),
    ('LYCHEE', 'KWAI MEI'),
    ('LYCHEE', 'LO MAI ZI'),
    ('LYCHEE', 'LYCHEE KING'),
    ('LYCHEE', 'LYCHEE SEEDLESS'),
    ('LYCHEE', 'OTHERS'),
    ('LYCHEE', 'SEEDLESS'),
    ('LYCHEE', 'YU HE BAO'),

    -- MANDARIN
    ('MANDARIN', 'AFOURER MANDARIN'),
    ('MANDARIN', 'BABY TANGERINE'),
    ('MANDARIN', 'CHUN JIAN'),
    ('MANDARIN', 'CLEMENVILLA'),
    ('MANDARIN', 'DA JI DA LI'),
    ('MANDARIN', 'GREEN KING MANDARIN'),
    ('MANDARIN', 'HONEY MURCOT'),
    ('MANDARIN', 'HONEY MURCOTT'),
    ('MANDARIN', 'HONEY TANGERINE'),
    ('MANDARIN', 'JEJU'),
    ('MANDARIN', 'KAM QUET'),
    ('MANDARIN', 'KING TANGERINE'),
    ('MANDARIN', 'KINO'),
    ('MANDARIN', 'LEANRI'),
    ('MANDARIN', 'LOKAM'),
    ('MANDARIN', 'MIKAN'),
    ('MANDARIN', 'NADORCOTT'),
    ('MANDARIN', 'NOVA'),
    ('MANDARIN', 'ORRI'),
    ('MANDARIN', 'ORTANIQUE'),
    ('MANDARIN', 'PAPAKAM'),
    ('MANDARIN', 'PHOENIX MANDARIN'),
    ('MANDARIN', 'PIXIE'),
    ('MANDARIN', 'PONKAM'),
    ('MANDARIN', 'RED BEAUTY'),
    ('MANDARIN', 'SATSUMA'),
    ('MANDARIN', 'SUGAR TANGERINE'),
    ('MANDARIN', 'TAI QUET'),
    ('MANDARIN', 'TAMBOR'),
    ('MANDARIN', 'TANGO'),
    ('MANDARIN', 'WOGAN'),
    ('MANDARIN', 'WOKAM'),
    ('MANDARIN', 'WU LOU'),

    -- MANGO
    ('MANGO', 'AHPING'),
    ('MANGO', 'AIWEN'),
    ('MANGO', 'BLACK GOLD'),
    ('MANGO', 'CALYPSA'),
    ('MANGO', 'CHOKONAN'),
    ('MANGO', 'DAVID HADEN'),
    ('MANGO', 'ELEPHANT TUSK'),
    ('MANGO', 'FALAN'),
    ('MANGO', 'GOLD DRAGON'),
    ('MANGO', 'GOLD ELEPHANT TUSK'),
    ('MANGO', 'GOLD KING'),
    ('MANGO', 'GOLD LILY'),
    ('MANGO', 'GOLD MILK'),
    ('MANGO', 'GOLD R2E2'),
    ('MANGO', 'GOLD RAINBOW'),
    ('MANGO', 'GOLD TAI ZHI'),
    ('MANGO', 'GREEN DRAGON'),
    ('MANGO', 'GREEN R2E2'),
    ('MANGO', 'HARUMANIS'),
    ('MANGO', 'HIMANPANSATH'),
    ('MANGO', 'JAPAN LILY'),
    ('MANGO', 'KADA'),
    ('MANGO', 'KAITER'),
    ('MANGO', 'KEIT'),
    ('MANGO', 'KING DELICIOUS'),
    ('MANGO', 'KING MANGO'),
    ('MANGO', 'MAHA CHANOOK'),
    ('MANGO', 'MAN TIN KWO'),
    ('MANGO', 'MANGO APPLE'),
    ('MANGO', 'MILK'),
    ('MANGO', 'OSTEEN'),
    ('MANGO', 'OTHERS'),
    ('MANGO', 'PEARL'),
    ('MANGO', 'PERLIS GOLD HARUMANIS'),
    ('MANGO', 'R2E2'),
    ('MANGO', 'R2E2 ORGANIC'),
    ('MANGO', 'RAINBOW'),
    ('MANGO', 'RED DRAGON'),
    ('MANGO', 'SHUI XIAN'),
    ('MANGO', 'TAI ZHI'),
    ('MANGO', 'ZILL'),

    -- MANGOSTEEN
    ('MANGOSTEEN', 'OTHERS'),

    -- MELON
    ('MELON', 'ACHIGOLD MAS'),
    ('MELON', 'CHARENTAIS JAUNE (PHILIBON)'),
    ('MELON', 'HAMIMELON'),
    ('MELON', 'HAMIMELON GREEN'),
    ('MELON', 'HAMIMELON YELLOW'),
    ('MELON', 'HEAVEN'),
    ('MELON', 'ITALIAN EGNAZIO'),
    ('MELON', 'JAPANESE GALAXY'),
    ('MELON', 'KAORISAN'),
    ('MELON', 'MUSKMELON'),
    ('MELON', 'OTHERS'),
    ('MELON', 'PEIL DE SAPO'),
    ('MELON', 'PHILIBON'),
    ('MELON', 'ROCK MELON'),
    ('MELON', 'SOLDIVE'),
    ('MELON', 'STARLIGHT MELON'),
    ('MELON', 'SUN MELON'),
    ('MELON', 'WATERMELON RED'),
    ('MELON', 'WATERMELON YELLOW'),

    -- MIXED
    ('MIXED', 'APPLES & ORANGES'),
    ('MIXED', 'FRUITS'),
    ('MIXED', 'RED & GREEN APPLES'),

    -- NECTARINE
    ('NECTARINE', 'CHERRY NECTARINE'),
    ('NECTARINE', 'DONUT NECTARINE'),
    ('NECTARINE', 'GOLDEN NECTARINE'),
    ('NECTARINE', 'MINI PEARL'),
    ('NECTARINE', 'OTHERS'),
    ('NECTARINE', 'STRAWBERRY NECTARINE'),
    ('NECTARINE', 'WHITE NECTARINE'),
    ('NECTARINE', 'YELLOW DONUT NECTARINE'),
    ('NECTARINE', 'YELLOW NECTARINE'),
    ('NECTARINE', 'YELLOW NECTARINE ORGANIC'),

    -- ORANGE
    ('ORANGE', 'AUTUMN GOLD'),
    ('ORANGE', 'BALADI VALENCIA'),
    ('ORANGE', 'BARNFIELD NAVEL'),
    ('ORANGE', 'BLOOD'),
    ('ORANGE', 'CAMBRIA NAVEL'),
    ('ORANGE', 'CAMBRIA NAVELATE'),
    ('ORANGE', 'CARA-CARA'),
    ('ORANGE', 'DELTA SEEDLESS'),
    ('ORANGE', 'GUSOCORA SEEDLESS'),
    ('ORANGE', 'HONG JIANG'),
    ('ORANGE', 'LATE LANE'),
    ('ORANGE', 'LATE LANE NAVEL'),
    ('ORANGE', 'LIU DING'),
    ('ORANGE', 'MIDKNIGHT'),
    ('ORANGE', 'NAVEL'),
    ('ORANGE', 'NAVELATE'),
    ('ORANGE', 'RED BEAUTY'),
    ('ORANGE', 'SUGAR'),
    ('ORANGE', 'SUMMER NAVEL'),
    ('ORANGE', 'VALENCIA'),
    ('ORANGE', 'WASHINGTON NAVEL'),
    ('ORANGE', 'WITKRANS'),
    ('ORANGE', 'WITKRANS NAVEL'),

    -- OTHERS
    ('OTHERS', 'OTHERS'),

    -- PAPAYA
    ('PAPAYA', 'OTHERS'),
    ('PAPAYA', 'SOLO'),

    -- PAPPLE
    ('PAPPLE', 'OTHERS'),

    -- PASSION FRUIT
    ('PASSION FRUIT', 'OTHERS'),
    ('PASSION FRUIT', 'YELLOW'),

    -- PEACH
    ('PEACH', 'APPLE PEACH'),
    ('PEACH', 'DONUT PEACH'),
    ('PEACH', 'FLAT PEACH'),
    ('PEACH', 'GOLDEN DONUT PEACH'),
    ('PEACH', 'GOLDEN PEACH'),
    ('PEACH', 'ICE PEACH'),
    ('PEACH', 'MINI RED'),
    ('PEACH', 'OTHERS'),
    ('PEACH', 'RED PEACH'),
    ('PEACH', 'WHITE PEACH'),
    ('PEACH', 'YELLOW PEACH'),
    ('PEACH', 'YELLOW PEACH ORGANIC'),

    -- PEAR
    ('PEAR', 'AUTUMN MOON'),
    ('PEAR', 'BOSC'),
    ('PEAR', 'CELINA (RED PEAR)'),
    ('PEAR', 'CENTURY'),
    ('PEAR', 'CHEEKY (RED PEAR)'),
    ('PEAR', 'CHERRY PEAR'),
    ('PEAR', 'CORELLA (RED PEAR)'),
    ('PEAR', 'D''ANJOU (RED PEAR)'),
    ('PEAR', 'EARLY FRAGANT'),
    ('PEAR', 'FENGSHUI'),
    ('PEAR', 'FORELLA (RED PEAR)'),
    ('PEAR', 'FRAGRANT'),
    ('PEAR', 'GOLDEN'),
    ('PEAR', 'GOLDEN PEACH'),
    ('PEAR', 'GONG'),
    ('PEAR', 'GREEN RUBY'),
    ('PEAR', 'HUA SHAN'),
    ('PEAR', 'NAN SHUI'),
    ('PEAR', 'OTHERS'),
    ('PEAR', 'PACKHAM (GREEN PEAR)'),
    ('PEAR', 'PARADISE'),
    ('PEAR', 'QIU YUE'),
    ('PEAR', 'RED PEAR'),
    ('PEAR', 'SINGO'),
    ('PEAR', 'SNOWFLAKE'),
    ('PEAR', 'SU PEAR'),
    ('PEAR', 'WILLIAM''S BON CHRETIEN'),
    ('PEAR', 'YA PEAR'),
    ('PEAR', 'YUANHUANG'),

    -- PERSIMMON
    ('PERSIMMON', 'KAKI'),
    ('PERSIMMON', 'OTHERS'),
    ('PERSIMMON', 'PERSIMMON CAKE'),
    ('PERSIMMON', 'SHARON'),

    -- PINEAPPLE
    ('PINEAPPLE', 'DRAGON NO.8'),
    ('PINEAPPLE', 'JOSA'),
    ('PINEAPPLE', 'MD2'),
    ('PINEAPPLE', 'N36'),
    ('PINEAPPLE', 'ORIJI MD2'),
    ('PINEAPPLE', 'OTHERS'),
    ('PINEAPPLE', 'PINEAPPLE GREEN NANAS HIJAU'),
    ('PINEAPPLE', 'ROMPINE MD2'),
    ('PINEAPPLE', 'SARAWAK'),
    ('PINEAPPLE', 'TROPICAL GOLD'),
    ('PINEAPPLE', 'YANKEE'),

    -- PLUM
    ('PLUM', 'AFRICAN DELIGHT'),
    ('PLUM', 'AMBER JEWEL'),
    ('PLUM', 'ANGELENO'),
    ('PLUM', 'AUTUMN GIANT'),
    ('PLUM', 'BELLE'),
    ('PLUM', 'BLACK AMBER'),
    ('PLUM', 'BLACK PEARL'),
    ('PLUM', 'BLACK PLUM'),
    ('PLUM', 'BLACK RUBY'),
    ('PLUM', 'BLACK SPENDOR'),
    ('PLUM', 'BLACK SPLENDOR'),
    ('PLUM', 'BLUE GUSTO RED PLUM'),
    ('PLUM', 'BLUEBERRY PLUM'),
    ('PLUM', 'CANDY GIANT'),
    ('PLUM', 'CATALINA'),
    ('PLUM', 'CHERRY PLUM'),
    ('PLUM', 'CRISPY'),
    ('PLUM', 'CRISPY GREEN PLUM'),
    ('PLUM', 'CRISPY RED PLUM'),
    ('PLUM', 'EBONY SWEET PLUOT'),
    ('PLUM', 'EMERALD BEAUTY (GREEN)'),
    ('PLUM', 'EMRALD BLUSH'),
    ('PLUM', 'FALAVOROSA'),
    ('PLUM', 'FLAVOR FALL'),
    ('PLUM', 'FLAVOR RICH'),
    ('PLUM', 'GREEN SUGAR PLUM'),
    ('PLUM', 'HONEY SUCKLE ROSE'),
    ('PLUM', 'HOWARD SUN'),
    ('PLUM', 'KING MIDAS'),
    ('PLUM', 'KRISSY PLUM'),
    ('PLUM', 'LAETITIA'),
    ('PLUM', 'LARRY ANN'),
    ('PLUM', 'MIDNIGHT JEWEL'),
    ('PLUM', 'MIDNIGHT STAR'),
    ('PLUM', 'OCTOBER SUN'),
    ('PLUM', 'OTHERS'),
    ('PLUM', 'PLUMCOT'),
    ('PLUM', 'PLUOT'),
    ('PLUM', 'PRIME TIME'),
    ('PLUM', 'PUNCH PLUOT'),
    ('PLUM', 'QUEEN CLAUDIA GREEN'),
    ('PLUM', 'RED PLUM'),
    ('PLUM', 'ROSE TAROYLI'),
    ('PLUM', 'ROYAL DIAMOND'),
    ('PLUM', 'RUBY DAWN'),
    ('PLUM', 'RUBY PLUOT'),
    ('PLUM', 'RUBY STAR'),
    ('PLUM', 'RUBY SUN'),
    ('PLUM', 'SAFARI STAR'),
    ('PLUM', 'SANTA ROSE'),
    ('PLUM', 'SIERRA SWEET'),
    ('PLUM', 'SONGOLD'),
    ('PLUM', 'SUGAR PLUM'),
    ('PLUM', 'SUGAR PRUNES'),
    ('PLUM', 'SUGARPLUM'),
    ('PLUM', 'SUNRISE'),
    ('PLUM', 'YUMMY BEAUTY RED'),

    -- POMEGRANATE
    ('POMEGRANATE', 'OTHERS'),
    ('POMEGRANATE', 'POMEGRANATE (DELIMA)'),
    ('POMEGRANATE', 'SOFT SEED'),

    -- POMELO
    ('POMELO', 'IPOH TAMBUN'),
    ('POMELO', 'ORGANIC RUBEE RED POMELO'),
    ('POMELO', 'OTHERS'),
    ('POMELO', 'RED POMELO'),
    ('POMELO', 'SWEETY POMELO'),
    ('POMELO', 'TAMBUN'),
    ('POMELO', 'WHITE POMELO'),

    -- POTATO
    ('POTATO', 'GOLDEN POTATO'),
    ('POTATO', 'HONEY POTATO'),
    ('POTATO', 'OTHERS'),
    ('POTATO', 'PURPLE POTATO'),
    ('POTATO', 'RUSSET POTATO'),
    ('POTATO', 'SWEET PURPLE POTATO'),
    ('POTATO', 'SWEET YELLOW POTATO'),
    ('POTATO', 'WASH POTATO'),
    ('POTATO', 'YELLOW POTATO'),

    -- PRUNES
    ('PRUNES', 'OTHERS'),

    -- PUMPKIN
    ('PUMPKIN', 'BEI BEI'),

    -- RAMBAI
    ('RAMBAI', 'OTHERS'),

    -- RAMBUTAN
    ('RAMBUTAN', 'OTHERS'),

    -- RASPBERRY
    ('RASPBERRY', 'OTHERS'),

    -- RICE
    ('RICE', 'BAJONG'),
    ('RICE', 'BARIO BROWN'),
    ('RICE', 'BARIO WHITE'),

    -- SALAK
    ('SALAK', 'OTHERS'),

    -- SAPODILLA
    ('SAPODILLA', 'OTHERS'),

    -- SOURSOP
    ('SOURSOP', 'OTHERS'),

    -- STAR FRUIT
    ('STAR FRUIT', 'OTHERS'),

    -- STRAWBERRY
    ('STRAWBERRY', 'OTHERS'),
    ('STRAWBERRY', 'RED STRAWBERRY'),
    ('STRAWBERRY', 'SNOW WHITE DIAMOND'),
    ('STRAWBERRY', 'THREE COLOUR DIAMOND'),
    ('STRAWBERRY', 'WHITE DIAMOND'),
    ('STRAWBERRY', 'WHITE STRAWBERRY'),

    -- SWEET POTATO
    ('SWEET POTATO', 'HONEY POTATO'),
    ('SWEET POTATO', 'MURASAKI'),
    ('SWEET POTATO', 'OTHERS'),
    ('SWEET POTATO', 'PURPLE POTATO'),
    ('SWEET POTATO', 'YELLOW POTATO'),
    ('SWEET POTATO', 'YELLOW SWEET POTATO'),

    -- VEGETABLES
    ('VEGETABLES', 'ASPARAGUS'),
    ('VEGETABLES', 'BABY CUCUMBER'),
    ('VEGETABLES', 'BABY KAI LAN'),
    ('VEGETABLES', 'BAMBOO SHOOT'),
    ('VEGETABLES', 'BEETROOT'),
    ('VEGETABLES', 'BEIJING CABBAGE'),
    ('VEGETABLES', 'BROCCOLI'),
    ('VEGETABLES', 'CAPSICUM GREEB'),
    ('VEGETABLES', 'CAPSICUM RED'),
    ('VEGETABLES', 'CAPSICUM YELLOW'),
    ('VEGETABLES', 'CELERY'),
    ('VEGETABLES', 'CHERRY TOMATO'),
    ('VEGETABLES', 'CHOI SUM'),
    ('VEGETABLES', 'GINGER'),
    ('VEGETABLES', 'GINGER POWDER'),
    ('VEGETABLES', 'GREEN ZUCCHINI'),
    ('VEGETABLES', 'GROUNDNUT'),
    ('VEGETABLES', 'HOLLAND BEAN'),
    ('VEGETABLES', 'HUAISHAN'),
    ('VEGETABLES', 'ICEBERG LETTUCE'),
    ('VEGETABLES', 'JAPANESE CUCUMBER'),
    ('VEGETABLES', 'KAI LAN'),
    ('VEGETABLES', 'KASTURI'),
    ('VEGETABLES', 'LONG YAM'),
    ('VEGETABLES', 'LOTUS ROOT'),
    ('VEGETABLES', 'NAI PAK'),
    ('VEGETABLES', 'NIPIS'),
    ('VEGETABLES', 'ORGANIC BITTER GOURD'),
    ('VEGETABLES', 'PETAI'),
    ('VEGETABLES', 'PURUT'),
    ('VEGETABLES', 'RED CABBAGE'),
    ('VEGETABLES', 'SEA COCONUT'),
    ('VEGETABLES', 'SHITAKE MUSHROOM'),
    ('VEGETABLES', 'SIEW PAK CHOI'),
    ('VEGETABLES', 'SMALL CABBAGE'),
    ('VEGETABLES', 'SPINACH'),
    ('VEGETABLES', 'SPROUT'),
    ('VEGETABLES', 'SWEET BEAN'),
    ('VEGETABLES', 'SWEET CORN'),
    ('VEGETABLES', 'TOMATO'),
    ('VEGETABLES', 'WATER CHESTNUT'),
    ('VEGETABLES', 'WAWA CHOY'),
    ('VEGETABLES', 'WHITE ONION'),
    ('VEGETABLES', 'YELLOW ZUCCHINI'),

    -- WAXBERRY
    ('WAXBERRY', 'OTHERS')

ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- INDEXES for fast lookup during description parsing
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ref_fruit_variants_fruit ON ref_fruit_variants (fruit);
CREATE INDEX IF NOT EXISTS idx_ref_fruit_aliases_standard ON ref_fruit_aliases (standard_name);
CREATE INDEX IF NOT EXISTS idx_ref_country_aliases_standard ON ref_country_aliases (standard_name);
