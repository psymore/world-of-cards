import type { GameRules } from '../components/RulesSummaryModal';
import { pistiRules } from './pisti/rules';
import { batakRules } from './batak/rules';
import { pisYedeliRules } from './pis-yedili/rules';

export const gameRules: Record<string, GameRules> = {
  pisti: pistiRules,
  batak: batakRules,
  'pis-yedili': pisYedeliRules,
};
