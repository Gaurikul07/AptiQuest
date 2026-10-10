import { Router } from 'express';
import { collegeLeaderboard, playerLeaderboard, listColleges } from '../services/leagueService.js';

const router = Router();
router.get('/colleges', (_req, res) => res.json(listColleges()));
router.get('/leaderboard/colleges', (_req, res) => res.json(collegeLeaderboard()));
router.get('/leaderboard/players', (_req, res) => res.json(playerLeaderboard()));
export default router;
