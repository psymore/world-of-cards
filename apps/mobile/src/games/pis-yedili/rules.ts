import type { GameRules } from '../../components/RulesSummaryModal';

export const pisYedeliRules: GameRules = {
  title: 'Pis Yedili Nasıl Oynanır?',
  sections: [
    {
      heading: 'Amaç',
      body: 'Elindeki tüm kartlardan ilk kurtulan oyuncu eli kazanır.',
    },
    {
      heading: 'Oynanış',
      body: 'Sıra sende, ortadaki yığının en üstündeki kartla aynı renk ya da aynı numarada bir kart oynayabilirsin. Vale ve 7 her zaman oynanabilir. Elinde oynayacak uygun kart yoksa desteden bir kart çekersin ya da pas geçersin — pas, oynatılacak kart olmadığında herzaman seçeneğindir.',
    },
    {
      heading: 'Vale',
      body: 'Vale her zaman oynanabilir ve bir sonraki oyuncu için geçerli olacak rengi sen belirlersin. Vale oynamak ayrıca sırayı bir kişi atlatır — 2 kişilik oyunda Vale oynadığında sıra tekrar sana gelir.',
    },
    {
      heading: '7 (Pis Yedi)',
      body: '7 oynarsan bir sonraki oyuncu 2 kart çekmek zorunda kalır. O oyuncu başka bir 7 oynayarak cezayı bir sonraki oyuncuya devredebilir (cezalar üst üste biner); devredemezse birikmiş toplam kartı çeker ve sıra kendisinde kalır.',
    },
  ],
};
