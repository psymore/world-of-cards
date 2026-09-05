import type { GameRules } from '../../components/RulesSummaryModal';

export const batakRules: GameRules = {
  title: 'Batak Nasıl Oynanır?',
  sections: [
    {
      heading: 'Amaç',
      body: 'Sırayla söz (ihale) alıp, o elde kaç el (trick) alacağını taahhüt ederek taahhüdünü tutturmaya çalışmak.',
    },
    {
      heading: 'İhale',
      body: 'Kartlar dağıtıldıktan sonra sırayla ya bir sayı söylersin (o elde en az o kadar el alacağını taahhüt edersin) ya da pas geçersin. En yüksek sayıyı söyleyen oyuncu ihaleyi kazanır ve koz rengini seçer. Herkes pas geçerse ihale, düşük bir taahhütle otomatik olarak bir oyuncuya verilir.',
    },
    {
      heading: 'Gömmeli (3 Kişilik) Farkı',
      body: '3 kişilik oyunda masada kapalı 4 kartlık bir "kitty" bulunur. İhaleyi kazanan oyuncu koz rengini seçtikten sonra bu 4 kartı eline alır, ancak elinin orijinal 16 kartı arasından istediği 4 kartı görünmeden gömer; kitty kartlarını gömemez. 4 kişilik oyunda kitty yoktur, koz seçilir seçilmez oyuna başlanır.',
    },
    {
      heading: 'Elin Oynanışı',
      body: 'Açılan rengin elinde varsa o renkten oynamak, üstelik mümkünse masadaki en yüksek karttan daha yükseğini oynamak zorundasın. O renk elinde yoksa koz oynayabilirsin (kozun da elinde varsa ve masada koz varsa, yine mümkünse daha yükseğini oynamak zorundasın). Koz da yoksa istediğin kartı atabilirsin. Koz, biri koz oynayana kadar açılış rengi olarak oynanamaz — elinde başka renk kalmadıysa bu kural uygulanmaz.',
    },
    {
      heading: 'Puanlama',
      body: 'İhaleyi alan oyuncu taahhüt ettiği sayıda (veya fazla) el alırsa aldığı el sayısı kadar puan kazanır; alamazsa taahhüdü kadar puan kaybeder. Diğer oyuncular aldıkları el sayısı kadar puan kazanır — ama çok az el alırlarsa (4 kişilikte hiç el almazlarsa, 3 kişilikte 2\'den az el alırlarsa) onlar da ihale miktarı kadar puan kaybeder.',
    },
  ],
};
