-- Add 'tracked' to project_status enum.
--
-- A 'tracked' project is an externally-launched Bags token that we index
-- for the explore/search surfaces but do NOT operate: no fee claims, no
-- snapshots, no contributor payouts. Workflow entry queries
-- (indexGithubDeltas, takeSnapshot, executePayout, computeLeaderboard)
-- must exclude this status; only the public read surfaces include it.

ALTER TYPE "project_status" ADD VALUE IF NOT EXISTS 'tracked';
