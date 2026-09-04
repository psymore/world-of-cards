import type { GameRules } from '../../components/RulesSummaryModal';

export const pistiRules: GameRules = {
  title: 'Pişti Nasıl Oynanır?',
  sections: [
    {
      heading: 'Amaç',
      body: 'Ortadaki yığından en çok kartı ve en değerli kartları toplayarak rakiplerinden yüksek puana ulaşmak.',
    },
    {
      heading: 'Kart Toplama',
      body: 'Sırayla elindeki bir kartı ortaya atarsın. Attığın kart, yığının en üstündeki kartla aynı numaraysa ya da bir Vale ise, yığındaki tüm kartları toplarsın. Yığının üstünde bir Vale varsa, onu ancak başka bir Vale ile toplayabilirsin.',
    },
    {
      heading: 'Pişti',
      body: 'Yığında tek kart varken üstüne aynı numarayı koyup toplarsan buna "pişti" denir ve 10 bonus puan kazanırsın. Yığındaki tek kart bir Vale ise ve onu bir Vale ile toplarsan bonus 20 puana çıkar.',
    },
    {
      heading: 'Puanlama',
      body: 'Topladığın kartlardan Aslar ve Valeler 1\'er puan, Sinek 2 kartı 2 puan, Karo 10 kartı 3 puan değerindedir. En çok kartı toplayan oyuncuya (veya takıma) ek 3 puan verilir — birden fazla oyuncu eşit sayıda kartla en öndeyse bu bonus verilmez.',
    },
    {
      heading: 'Elin Sonu',
      body: 'Kartlar bitince yeniden dağıtılır; desteden çekilecek kart kalmayınca el sona erer ve masada kalan son kartlar en son toplamayı yapan oyuncuya geçer. En yüksek toplam puana sahip oyuncu (veya takım) eli kazanır.',
    },
  ],
};
