#!/bin/bash
# Run from the homeflow project root to deploy updated Firestore security rules.
# The current rules protect generic SMART-on-FHIR collections and provider metadata.
cd "$(dirname "$0")"
firebase deploy --only firestore:rules --project streamsync-8ae79
