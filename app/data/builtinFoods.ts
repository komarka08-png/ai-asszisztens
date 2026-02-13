// app/data/builtinFoods.ts

export type FoodCategoryId =
  | 'MEAT'      // Húsok
  | 'FISH'      // Halak
  | 'DAIRY'     // Tejtermékek
  | 'GRAIN'     // Pékáruk
  | 'VEG'       // Zöldségek
  | 'FRUIT'     // Gyümölcsök
  | 'NUTS'      // Magvak
  | 'CUSTOM';   // Saját ételek

export type FoodCategory = {
  id: FoodCategoryId;
  label: string;
};

export const FOOD_CATEGORIES: FoodCategory[] = [
  { id: 'MEAT',   label: 'Húsok' },
  { id: 'FISH',   label: 'Halak' },
  { id: 'DAIRY',  label: 'Tejtermékek' },
  { id: 'GRAIN',  label: 'Pékáruk' },
  { id: 'VEG',    label: 'Zöldségek' },
  { id: 'FRUIT',  label: 'Gyümölcsök' },
  { id: 'NUTS',   label: 'Magvak' },
  { id: 'CUSTOM', label: 'Saját ételek' },
];

export type Food = {
  id: string;
  name: string;
  carbs: number;         // g / 100 g
  category: FoodCategoryId;
};

export const BUILTIN_FOODS: Food[] = [
  /* ===== HÚSOK (MEAT) ===== */
  { id: 'csirkemell',    name: 'Csirkemell',      carbs: 0.5, category: 'MEAT' },
  { id: 'csirkecomb',    name: 'Csirkecomb',      carbs: 0.5, category: 'MEAT' },
  { id: 'csirkeszarny',  name: 'Csirkeszárny',    carbs: 0.2, category: 'MEAT' },
  { id: 'pulykamell',    name: 'Pulykamell',      carbs: 0.4, category: 'MEAT' },
  { id: 'serteskaraj',   name: 'Sertéskaraj',     carbs: 0.4, category: 'MEAT' },
  { id: 'serteslapocka', name: 'Sertéslapocka',   carbs: 0.3, category: 'MEAT' },
  { id: 'sertescomb',    name: 'Sertéscomb',      carbs: 0.4, category: 'MEAT' },
  { id: 'daratthuss',    name: 'Darált hús',      carbs: 0.5, category: 'MEAT' },
  { id: 'marhahus',      name: 'Marhahús',        carbs: 0.6, category: 'MEAT' },
  { id: 'daratmarha',    name: 'Darált marhahús', carbs: 0.6, category: 'MEAT' },

  /* ===== HALAK (FISH) ===== */
  { id: 'hal',    name: 'Hal',    carbs: 0.2, category: 'FISH' },
  { id: 'lazac',  name: 'Lazac',  carbs: 0.2, category: 'FISH' },
  { id: 'tonhal', name: 'Tonhal', carbs: 1.2, category: 'FISH' },

  /* ===== TEJTERMÉKEK (DAIRY) ===== */
  { id: 'tej',        name: 'Tej',        carbs: 5.3, category: 'DAIRY' },
  { id: 'joghurt',    name: 'Joghurt',    carbs: 4.6, category: 'DAIRY' },
  { id: 'tejfol',     name: 'Tejföl',     carbs: 4.0, category: 'DAIRY' },
  { id: 'turo',       name: 'Túró',       carbs: 3.8, category: 'DAIRY' },
  { id: 'sajt',       name: 'Sajt',       carbs: 1.7, category: 'DAIRY' },
  { id: 'mozzarella', name: 'Mozzarella', carbs: 2.0, category: 'DAIRY' },
  { id: 'vaj',        name: 'Vaj',        carbs: 0.3, category: 'DAIRY' },
  { id: 'tejszin',    name: 'Tejszín',    carbs: 3.9, category: 'DAIRY' },

  /* ===== PÉKÁRUK (GRAIN) ===== */
  // { id: 'kenyer',         name: 'Kenyér',          carbs: 54.5, category: 'GRAIN' }, // ❌ kivéve (van fehér/barna/félbarna)
  { id: 'feherkenyer',    name: 'Fehér kenyér',    carbs: 52.3, category: 'GRAIN' },
  { id: 'barnakenyer',    name: 'Barna kenyér',    carbs: 50.6, category: 'GRAIN' },
  { id: 'felbarnakenyer', name: 'Félbarna kenyér', carbs: 47.9, category: 'GRAIN' },
  { id: 'zsemle',         name: 'Zsemle',          carbs: 57.0, category: 'GRAIN' },
  { id: 'kifli',          name: 'Kifli',           carbs: 58.0, category: 'GRAIN' },
  { id: 'zabpehely',      name: 'Zabpehely',       carbs: 64.3, category: 'GRAIN' },
  { id: 'rizs',           name: 'Rizs',            carbs: 77.5, category: 'GRAIN' },
  { id: 'barnarizs',      name: 'Barna rizs',      carbs: 72.0, category: 'GRAIN' },
  { id: 'teszta',         name: 'Tészta',          carbs: 75.1, category: 'GRAIN' },
  { id: 'spagetti',       name: 'Spagetti',        carbs: 75.1, category: 'GRAIN' },
  { id: 'penne',          name: 'Penne',           carbs: 75.1, category: 'GRAIN' },
  { id: 'liszt',          name: 'Liszt',           carbs: 70.4, category: 'GRAIN' },

  /* ===== ZÖLDSÉGEK (VEG) ===== */
  { id: 'burgonya',     name: 'Burgonya',     carbs: 20.0, category: 'VEG' },
  { id: 'edesburgonya', name: 'Édesburgonya', carbs: 17.0, category: 'VEG' },
  { id: 'sargarepa',    name: 'Sárgarépa',    carbs: 8.1,  category: 'VEG' },
  { id: 'uborka',       name: 'Uborka',       carbs: 1.7,  category: 'VEG' },
  { id: 'paprika',      name: 'Paprika',      carbs: 3.0,  category: 'VEG' },
  { id: 'paradicsom',   name: 'Paradicsom',   carbs: 4.0,  category: 'VEG' },
  { id: 'cukkini',      name: 'Cukkini',      carbs: 3.0,  category: 'VEG' },
  { id: 'karfiol',      name: 'Karfiol',      carbs: 3.0,  category: 'VEG' },
  { id: 'brokkoli',     name: 'Brokkoli',     carbs: 2.1,  category: 'VEG' },
  { id: 'kaposzta',     name: 'Káposzta',     carbs: 6.0,  category: 'VEG' },
  { id: 'hagyma',       name: 'Hagyma',       carbs: 9.3,  category: 'VEG' },
  { id: 'voroshagyma',  name: 'Vöröshagyma',  carbs: 9.0,  category: 'VEG' },
  { id: 'fokhagyma',    name: 'Fokhagyma',    carbs: 30.0, category: 'VEG' },
  { id: 'zoldborso',    name: 'Zöldborsó',    carbs: 14.0, category: 'VEG' },
  { id: 'kukorica',     name: 'Kukorica',     carbs: 23.6, category: 'VEG' },
  { id: 'zoldbab',      name: 'Zöldbab',      carbs: 6.8,  category: 'VEG' },
  { id: 'lencse',       name: 'Lencse',       carbs: 60.0, category: 'VEG' },
  { id: 'bab',          name: 'Bab',          carbs: 27.0, category: 'VEG' },

  /* ===== GYÜMÖLCSÖK (FRUIT) ===== */
  { id: 'alma',        name: 'Alma',        carbs: 7.0,  category: 'FRUIT' },
  { id: 'korte',       name: 'Körte',       carbs: 12.0, category: 'FRUIT' },
  { id: 'banan',       name: 'Banán',       carbs: 24.2, category: 'FRUIT' },
  { id: 'narancs',     name: 'Narancs',     carbs: 8.5,  category: 'FRUIT' },
  { id: 'mandarin',    name: 'Mandarin',    carbs: 10.8, category: 'FRUIT' },
  { id: 'grapefruit',  name: 'Grapefruit',  carbs: 7.2,  category: 'FRUIT' },
  { id: 'eper',        name: 'Eper',        carbs: 7.2,  category: 'FRUIT' },
  { id: 'szolo',       name: 'Szőlő',       carbs: 18.1, category: 'FRUIT' },
  { id: 'oszibarack',  name: 'Őszibarack',  carbs: 9.0,  category: 'FRUIT' },
  { id: 'meggy',       name: 'Meggy',       carbs: 11.0, category: 'FRUIT' },
  { id: 'cseresznye',  name: 'Cseresznye',  carbs: 14.0, category: 'FRUIT' },
  { id: 'sargabarack', name: 'Sárgabarack', carbs: 9.0,  category: 'FRUIT' },
  { id: 'dinnye',      name: 'Dinnye',      carbs: 9.5,  category: 'FRUIT' },
  { id: 'ananasz',     name: 'Ananász',     carbs: 12.0, category: 'FRUIT' },

  /* ===== MAGVAK (NUTS) ===== */
  { id: 'mogyoro',       name: 'Mogyoró',       carbs: 8.7,  category: 'NUTS' },
  { id: 'mandula',       name: 'Mandula',       carbs: 6.8,  category: 'NUTS' },
  { id: 'dio',           name: 'Dió',           carbs: 11.7, category: 'NUTS' },
  { id: 'napraforgomag', name: 'Napraforgómag', carbs: 17.4, category: 'NUTS' },
  { id: 'kesudio',       name: 'Kesudió',       carbs: 32.0, category: 'NUTS' },
  { id: 'kokusz',        name: 'Kókusz',        carbs: 10.0, category: 'NUTS' },
];
