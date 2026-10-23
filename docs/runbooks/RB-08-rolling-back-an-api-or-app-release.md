# RB-08: Rolling Back an API or App Release

## 1. Trigger
Critical bug, security defect, or severe regression discovered immediately following a production deployment.

## 2. First Five Minutes
1. Halt ongoing deployment pipeline in GitHub Actions / CodeDeploy.
2. Notify engineering leads and incident management channel.
3. Identify previous stable release commit SHA and container image digest.
4. Issue rollback deployment command.

## 3. Diagnosis
- Review diff between previous release and broken release.
- Verify whether database schema migrations were applied and whether they are backward-compatible (expand-only per P0-T5).
- Check client error reports in Sentry and crash logs.

## 4. Mitigation
- Roll back ECS task definition to previous stable task revision.
- If mobile app release affected: halt Google Play / Apple staged rollout immediately.
- Flush CloudFront edge cache if static web console assets were affected.
- Verify health probes return 200 OK across all rolled-back instances.

## 5. Communication Template
> DEPLOYMENT NOTICE: Production release rolled back to previous stable baseline. Services operational and verified.

## 6. Post-Incident Review
A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
