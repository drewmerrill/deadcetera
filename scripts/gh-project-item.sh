#!/bin/bash
# Bash 3 compatible (no associative arrays)
# Usage: gl-item TITLE BODY_FILE STAGE STATUS OWNER IMPACT EFFORT LINKED_SPEC CLOSE
# Args: stage ∈ {Idea,Verified,RequirementsDesign,Ready,Building,UAT,Shipped}
#       status ∈ {Todo,InProgress,Done}
#       owner ∈ {Drew,Claude,Pierce}
#       impact ∈ {S,M,L,XL}
#       effort ∈ {1d,3d,1w,2wp}
PROJECT_ID="PVT_kwHOD4FZTs4BXCGM"
STAGE_F="PVTSSF_lAHOD4FZTs4BXCGMzhSR0A0"
STATUS_F="PVTSSF_lAHOD4FZTs4BXCGMzhSRz44"
OWNER_F="PVTSSF_lAHOD4FZTs4BXCGMzhSR0Dg"
IMPACT_F="PVTSSF_lAHOD4FZTs4BXCGMzhSR0DY"
EFFORT_F="PVTSSF_lAHOD4FZTs4BXCGMzhSR0Dc"
SPEC_F="PVTF_lAHOD4FZTs4BXCGMzhSR0F4"

# Option lookup via case
opt_for() {
  case "$1" in
    Stage_Idea) echo "24044220";; Stage_Verified) echo "d71d4ad3";; Stage_RequirementsDesign) echo "0d25c6d5";;
    Stage_Ready) echo "db8d6738";; Stage_Building) echo "76507750";; Stage_UAT) echo "23bcd020";; Stage_Shipped) echo "142ee4a4";;
    # Back-compat aliases (Pierce-renamed 2026-05-30): map old names to new option IDs
    Stage_Exploring) echo "d71d4ad3";; Stage_Specced) echo "0d25c6d5";;
    Status_Todo) echo "f75ad846";; Status_InProgress) echo "47fc9ee4";; Status_Done) echo "98236657";;
    Owner_Drew) echo "10315c30";; Owner_Claude) echo "9d810a2b";; Owner_Pierce) echo "8cc01516";;
    Impact_S) echo "54b2fac7";; Impact_M) echo "dafa5ae2";; Impact_L) echo "067360ad";; Impact_XL) echo "95ff6dc6";;
    Effort_1d) echo "a4a172b5";; Effort_3d) echo "0effc25d";; Effort_1w) echo "7adc8789";; Effort_2wp) echo "c98a4e2c";;
    *) echo "";;
  esac
}

TITLE="$1"; BODY_FILE="$2"; STAGE="$3"; STATUS_VAL="$4"; OWNER_VAL="$5"; IMPACT_VAL="$6"; EFFORT_VAL="$7"
LINKED_SPEC="$8"; CLOSE_AFTER="$9"

URL=$(gh issue create --repo drewmerrill/deadcetera --title "$TITLE" --body-file "$BODY_FILE" 2>&1 | tail -1)
echo "$TITLE"
echo "  → $URL"
ITEM_ID=$(gh project item-add 1 --owner drewmerrill --url "$URL" --format json 2>&1 | jq -r '.id')
[ -z "$ITEM_ID" ] && { echo "  ERROR: no item id"; exit 1; }

set_field() {
  local F="$1"; local FID="$2"; local VAL="$3"
  [ -z "$VAL" ] && return
  local OID=$(opt_for "${F}_${VAL}")
  [ -z "$OID" ] && { echo "  WARN: no option for ${F}=${VAL}"; return; }
  gh project item-edit --project-id "$PROJECT_ID" --id "$ITEM_ID" --field-id "$FID" --single-select-option-id "$OID" >/dev/null 2>&1
}
set_field Stage "$STAGE_F" "$STAGE"
set_field Status "$STATUS_F" "$STATUS_VAL"
set_field Owner "$OWNER_F" "$OWNER_VAL"
set_field Impact "$IMPACT_F" "$IMPACT_VAL"
set_field Effort "$EFFORT_F" "$EFFORT_VAL"
if [ -n "$LINKED_SPEC" ]; then
  gh project item-edit --project-id "$PROJECT_ID" --id "$ITEM_ID" --field-id "$SPEC_F" --text "$LINKED_SPEC" >/dev/null 2>&1
fi
if [ "$CLOSE_AFTER" = "close" ]; then
  gh issue close --repo drewmerrill/deadcetera "$URL" >/dev/null 2>&1
fi
echo "  ✓ Configured"
