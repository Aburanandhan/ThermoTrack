export interface SportDefinition {
  id: string
  name: string
  categories: string[]
}

export const SPORTS_CATALOGUE: SportDefinition[] = [
  {
    id: 'track_and_field',
    name: 'Track & Field',
    categories: ['Sprint', 'Distance', 'Hurdles', 'Jumps', 'Throws', 'Combined Events'],
  },
  {
    id: 'running',
    name: 'Running',
    categories: ['Sprint', 'Middle Distance', 'Long Distance', 'Marathon', 'Trail Running'],
  },
  {
    id: 'cycling',
    name: 'Cycling',
    categories: ['Road', 'Track', 'Mountain Bike', 'Time Trial', 'Gravel'],
  },
  {
    id: 'football',
    name: 'Football',
    categories: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'General Squad'],
  },
  {
    id: 'cricket',
    name: 'Cricket',
    categories: ['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'],
  },
  {
    id: 'basketball',
    name: 'Basketball',
    categories: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
  },
  {
    id: 'tennis',
    name: 'Tennis',
    categories: ['Singles', 'Doubles'],
  },
  {
    id: 'swimming',
    name: 'Swimming',
    categories: ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley', 'Open Water'],
  },
  {
    id: 'hockey',
    name: 'Hockey',
    categories: ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'],
  },
  {
    id: 'volleyball',
    name: 'Volleyball',
    categories: ['Setter', 'Outside Hitter', 'Opposite Hitter', 'Middle Blocker', 'Libero'],
  },
  {
    id: 'wrestling',
    name: 'Wrestling',
    categories: ['Freestyle', 'Greco-Roman'],
  },
  {
    id: 'boxing',
    name: 'Boxing',
    categories: ['Flyweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Heavyweight'],
  },
  {
    id: 'badminton',
    name: 'Badminton',
    categories: ['Singles', 'Doubles', 'Mixed Doubles'],
  },
  {
    id: 'other',
    name: 'Other',
    categories: ['General Squad', 'Individual'],
  },
]

export function getCategoriesForSport(sportName: string): string[] {
  const match = SPORTS_CATALOGUE.find(
    (s) => s.name.toLowerCase() === sportName.toLowerCase() || s.id.toLowerCase() === sportName.toLowerCase(),
  )
  return match ? match.categories : ['General Squad', 'Individual']
}
