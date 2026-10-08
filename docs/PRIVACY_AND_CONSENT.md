# Privacy, Safety and Consent — Design Requirements

This document is a technical design checklist, not a legal compliance certification. Obtain qualified South African POPIA and employment-law review before production use.

## Data minimisation

The personal profile uses voluntary, self-reported statements. Do not infer age, disability, mental health, personality disorders, home circumstances or protected characteristics. Do not mine historical school marks for recruitment.

## Access

1. The employer identifies a specific individual and purpose; there is **no browsing directory** of private learner profiles.
2. The individual receives a pending request, showing company, requested data category and purpose.
3. Individual approval creates a seven-day grant; denial reveals nothing.
4. The individual may revoke access at any time; the server checks grant status and expiry for each read.
5. Every disclosure emits an audit event.
6. Company administrators may publish opportunity listings without obtaining private profile access.

## Default disablement and missing safeguards

`ENABLE_EMPLOYER_ACCESS_PILOT` defaults off. This stops new employer access requests and employer profile reads. It is **not safe to turn on in general production** until:
- adult age verification and separate guardian/minor flow where appropriate;
- verified employer identity, contract, subscription entitlement and purpose review;
- rate limits, anti-enumeration and anti-harassment controls;
- records of notice/consent language and privacy policy version;
- withdrawal, data export, correction, objection, deletion and retention procedures;
- data breach response, audit retention and organisational risk assessment;
- tests proving no cross-tenant or cross-user disclosure.

## Sensitive populations

School history from Grade RR through matric is particularly sensitive. A child's records must not be made visible to recruiters merely because that person later becomes an adult. Create separate verified credential abstractions and opt-in migration rules only after legal and ethical review. Do not permit educator free-text notes to become recruiter personality labels.

## AI and fairness

Future strengths/career insights should be suggestions with displayed provenance, not definitive predictions. Any psychometric selection needs established validity, reliability, fairness and non-bias review. Prohibit auto-hire/auto-reject scoring, hidden sensitive-attribute inference and commercially sold personality categorisation. Include human review and contestability.

## Threat modelling starting points

Cross-tenant profile access; forged subject approval; ID enumeration; repeated unsolicited access requests; abusive opportunity descriptions; stored XSS; audit tampering; unauthorised access after expiry; unauthorized learner-to-parent/teacher disclosure. Track mitigations and tests in the roadmap.
