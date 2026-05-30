
export interface Developer {
  id: string;
  name: string;
  foundedYear: number;
  headquarters: string;
  logoUrl: string;
  isIndependent: boolean;
  notableTitles: string[];
}

export interface Game {
  id: string;
  title: string;
  description: string;
  genre: string;
  price: number;
  releaseDate: string;
  isMultiplayer: boolean;
  imageUrl: string;
  platforms: string[];
  difficulty: string;
  developer: Developer;
}
export interface Studio {
  id: string;
  name: string;
  country: string;
  foundedYear: number;
  founder: string;
  headquarters: string;
  logoUrl: string;
  isIndependent: boolean;
  notableGamesIds: string[];
}