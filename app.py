from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import requests
import zipfile
import json
import pandas as pd
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import asyncio
from io import BytesIO
import tempfile
import os
import time

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path



ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
# Define paths
ROOT_DIR = Path(__file__).parent
STATIC_DIR = ROOT_DIR / "static"

# Mount static files at /static (for js/css)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Serve index.html at root
@app.get("/")
async def serve_index():
    return FileResponse(STATIC_DIR / "index.html")

# Catch-all for client-side routing (optional)
@app.get("/{full_path:path}")
async def serve_static_or_index(full_path: str):
    file_path = STATIC_DIR / full_path
    if file_path.exists():
        return FileResponse(file_path)
    return FileResponse(STATIC_DIR / "index.html")



# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Mumbai Indians 2025 squad
MI_PLAYERS = [
    # Retained players
    "Jasprit Bumrah", "Suryakumar Yadav", "Hardik Pandya", "Rohit Sharma", "Tilak Varma",
    # New acquisitions
    "Trent Boult", "Deepak Chahar", "Will Jacks", "Naman Dhir", "Allah Ghazanfar",
    "Mitchell Santner", "Ryan Rickelton", "Reece Topley", "Lizaad Williams", "Robin Minz",
    "Karn Sharma", "Ashwani Kumar", "Shrijith Krishnan", "Raj Angad Bawa", "Satyanarayana Raju",
    "Bevon Jacobs", "Arjun Tendulkar", "Vignesh Puthur", "Mujeeb Ur Rahman", "Corbin Bosch",
    # Latest additions - 2025 season
    "JM Bairstow", "RJ Gleeson", "Charith Asalanka"
]

# Alternative name mappings for player matching - COMPREHENSIVE MAPPING
PLAYER_ALTERNATIVES = {
    "Jasprit Bumrah": ["J Bumrah", "JJ Bumrah", "Bumrah"],
    "Suryakumar Yadav": ["SA Yadav"],
    "Hardik Pandya": ["H Pandya", "HH Pandya", "Pandya"],
    "Rohit Sharma": ["RG Sharma"],
    "Tilak Varma": ["T Varma", "Tilak"],
    "Trent Boult": ["TA Boult", "T Boult", "Boult"],
    "Deepak Chahar": ["D Chahar", "DL Chahar", "Chahar"],
    "Will Jacks": ["WG Jacks", "W Jacks", "Jacks"],
    "Mitchell Santner": ["MJ Santner", "M Santner", "Santner"],
    "Ryan Rickelton": ["R Rickelton", "RD Rickelton", "Rickelton"],
    "Reece Topley": ["RJW Topley", "R Topley", "Topley"],
    "Arjun Tendulkar": ["A Tendulkar", "Tendulkar"],
    "Vignesh Puthur": ["V Puthur", "Puthur"],
    "Satyanarayana Raju": ["PVSN Raju", "Raju", "Satyanarayana"],
    "Naman Dhir": ["N Dhir", "Dhir"],
    "Allah Ghazanfar": ["A Ghazanfar", "Ghazanfar"],
    "Robin Minz": ["R Minz", "Minz"],
    "Karn Sharma": ["K Sharma", "Sharma"],
    "Ashwani Kumar": ["A Kumar", "Kumar"],
    "Shrijith Krishnan": ["S Krishnan", "Krishnan"],
    "Raj Angad Bawa": ["RA Bawa", "R Bawa", "Bawa"],
    "Bevon Jacobs": ["B Jacobs", "Jacobs"],
    "Lizaad Williams": ["L Williams", "Williams"],
    "Mujeeb Ur Rahman": ["Mujeeb", "M Rahman", "Mujeeb Rahman"],
    "Corbin Bosch": ["C Bosch", "Bosch"],
    # Latest additions - 2025 season
    "JM Bairstow": ["J Bairstow", "Jinny Bairstow", "Bairstow"],
    "RJ Gleeson": ["R Gleeson", "Richard Gleeson", "Gleeson"],
    "Charith Asalanka": ["C Asalanka", "KIC Asalanka", "Asalanka"]
}

# Define Models
class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: Optional[str] = None
    team: str = "Mumbai Indians"
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MatchData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_name: str
    match_id: str
    team1: str
    team2: str
    venue: str
    city: Optional[str] = None
    date: str
    format: str
    tournament: str
    season: Optional[str] = None
    gender: str = "male"
    batting_stats: Optional[Dict[str, Any]] = None
    bowling_stats: Optional[Dict[str, Any]] = None
    fielding_stats: Optional[Dict[str, Any]] = None
    match_result: Optional[str] = None
    total_deliveries_involved: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DataSyncStatus(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str
    last_sync: datetime
    total_matches: int = 0
    total_players: int = 0
    message: str = ""

def normalize_player_name(name: str) -> str:
    """Normalize player name for better matching"""
    if not name:
        return ""
    
    # Remove common prefixes and suffixes
    name = name.strip()
    name = name.replace("(c)", "").replace("(wk)", "").replace("†", "").replace("*", "")
    name = name.strip()
    
    return name

def get_canonical_player_name(player_name: str, teams_in_match: set = None) -> str:
    """Get the canonical Mumbai Indians player name from any variant"""
    if not player_name:
        return ""
    
    normalized = normalize_player_name(player_name)
    
    # Direct match in MI_PLAYERS
    if normalized in MI_PLAYERS:
        return normalized
    
    # Check alternatives - return the canonical name
    for canonical_name, alternatives in PLAYER_ALTERNATIVES.items():
        if normalized in alternatives or normalized == canonical_name:
            return canonical_name
    
    # Only do fuzzy matching if Mumbai Indians is one of the teams in the match
    if teams_in_match and ("Mumbai Indians" in teams_in_match):
        # More restrictive fuzzy matching - require significant overlap
        for mi_player in MI_PLAYERS:
            # Split names and check if substantial parts match
            normalized_parts = set(normalized.lower().split())
            mi_player_parts = set(mi_player.lower().split())
            
            # Require at least 2 name parts to match, or full surname match
            if len(normalized_parts.intersection(mi_player_parts)) >= 2:
                return mi_player
            
            # Or check if it's a very close match (90%+ similarity)
            from difflib import SequenceMatcher
            similarity = SequenceMatcher(None, normalized.lower(), mi_player.lower()).ratio()
            if similarity > 0.9:
                return mi_player
    
    return normalized  # Return as-is if no match found

async def cleanup_duplicate_players():
    """Remove duplicate player entries and standardize player names"""
    try:
        updated_count = 0
        
        # Get all unique player names that need standardization
        all_players = await db.matches.distinct("player_name")
        
        for original_name in all_players:
            # For cleanup, we can't know the teams, so pass None (will skip fuzzy matching)
            canonical_name = get_canonical_player_name(original_name, None)
            
            if canonical_name != original_name:
                # Update all records with this player name
                result = await db.matches.update_many(
                    {"player_name": original_name},
                    {"$set": {"player_name": canonical_name}}
                )
                updated_count += result.modified_count
                logging.info(f"Updated {result.modified_count} records: {original_name} -> {canonical_name}")
        
        # Remove duplicate match records (same match_id + player_name combination)
        # This is more complex, so we'll use aggregation to identify and remove duplicates
        pipeline = [
            {
                "$group": {
                    "_id": {
                        "match_id": "$match_id",
                        "player_name": "$player_name"
                    },
                    "doc_ids": {"$push": "$_id"},
                    "count": {"$sum": 1}
                }
            },
            {
                "$match": {
                    "count": {"$gt": 1}
                }
            }
        ]
        
        duplicates = await db.matches.aggregate(pipeline).to_list(1000)
        duplicate_removals = 0
        
        for duplicate_group in duplicates:
            # Keep the first document, remove the rest
            docs_to_remove = duplicate_group["doc_ids"][1:]  # Skip first, remove rest
            if docs_to_remove:
                result = await db.matches.delete_many({"_id": {"$in": docs_to_remove}})
                duplicate_removals += result.deleted_count
                logging.info(f"Removed {result.deleted_count} duplicate records for match {duplicate_group['_id']['match_id']} - player {duplicate_group['_id']['player_name']}")
        
        logging.info(f"Cleanup completed: {updated_count} names standardized, {duplicate_removals} duplicates removed")
        return updated_count + duplicate_removals
        
    except Exception as e:
        logging.error(f"Error during cleanup: {e}")
        raise e

async def cleanup_rg_sharma():
    """Update 'RG Sharma' to its canonical name 'Rohit Sharma'"""
    try:
        original_name = "RG Sharma"
        canonical_name = get_canonical_player_name(original_name, teams_in_match=None)
        updated_count = 0

        if canonical_name != original_name:
            result = await db.matches.update_many(
                {"player_name": original_name},
                {"$set": {"player_name": canonical_name}}
            )
            updated_count = result.modified_count
            logging.info(f"Updated {result.modified_count} records: {original_name} -> {canonical_name}")
        else:
            logging.info("No update needed. Canonical name is same as original.")
                                 
        
        # Remove duplicate match records (same match_id + player_name combination)
        # This is more complex, so we'll use aggregation to identify and remove duplicates
        pipeline = [
            {
                "$group": {
                    "_id": {
                        "match_id": "$match_id",
                        "player_name": "$player_name"
                    },
                    "doc_ids": {"$push": "$_id"},
                    "count": {"$sum": 1}
                }
            },
            {
                "$match": {
                    "count": {"$gt": 1}
                }
            }
        ]
        
        duplicates = await db.matches.aggregate(pipeline).to_list(1000)
        duplicate_removals = 0
        
        for duplicate_group in duplicates:
            # Keep the first document, remove the rest
            docs_to_remove = duplicate_group["doc_ids"][1:]  # Skip first, remove rest
            if docs_to_remove:
                result = await db.matches.delete_many({"_id": {"$in": docs_to_remove}})
                duplicate_removals += result.deleted_count
                logging.info(f"Removed {result.deleted_count} duplicate records for match {duplicate_group['_id']['match_id']} - player {duplicate_group['_id']['player_name']}")
        
        logging.info(f"Cleanup completed: {updated_count} names standardized, {duplicate_removals} duplicates removed")
        return updated_count + duplicate_removals
        
    except Exception as e:
        logging.error(f"Error during cleanup: {e}")
        raise e

def is_mi_player(player_name: str) -> bool:
    """Check if a player is in Mumbai Indians squad (strict matching only)"""
    normalized = normalize_player_name(player_name)
    
    # Direct match
    if normalized in MI_PLAYERS:
        return True
    
    # Check alternatives - ONLY exact matches in the alternatives list
    for mi_player, alternatives in PLAYER_ALTERNATIVES.items():
        if normalized in alternatives or normalized == mi_player:
            return True
    
    # NO fuzzy matching - only exact matches to prevent false positives
    return False

def process_cricket_data(json_files: List[Dict]) -> List[Dict]:
    """Comprehensive cricket data processing - extract ALL datapoints for MI players across ALL formats"""
    all_matches = []
    processed_matches = set()  # Track unique matches to avoid duplicates
    
    logging.info(f"Starting comprehensive analysis of {len(json_files)} JSON files...")
    
    for idx, json_data in enumerate(json_files):
        try:
            if idx % 100 == 0:
                logging.info(f"Processing file {idx+1}/{len(json_files)}")
            
            # Step 1: Extract basic match info first
            info_data = json_data.get('info', {})
            
            # Extract comprehensive match information
            match_info = {
                'match_id': info_data.get('match_id', f"match_{idx}"),
                'dates': info_data.get('dates', ['Unknown']),
                'teams': info_data.get('teams', ['Team1', 'Team2']),
                'venue': info_data.get('venue', 'Unknown'),
                'city': info_data.get('city', 'Unknown'),
                'match_type': info_data.get('match_type', 'Unknown'),
                'season': info_data.get('season', 'Unknown'),
                'gender': info_data.get('gender', 'male'),
                'outcome': info_data.get('outcome', {}),
                'players': info_data.get('players', {}),
                'event': info_data.get('event', {})
            }
            
            # Create unique match identifier
            date_str = match_info['dates'][0] if isinstance(match_info['dates'], list) and match_info['dates'] else 'Unknown'
            team1 = match_info['teams'][0] if isinstance(match_info['teams'], list) and len(match_info['teams']) > 0 else 'Team1'
            team2 = match_info['teams'][1] if isinstance(match_info['teams'], list) and len(match_info['teams']) > 1 else 'Team2'
            
            unique_match_id = f"{date_str}_{team1}_{team2}_{match_info['venue']}"
            
            # Skip if already processed
            if unique_match_id in processed_matches:
                continue
            processed_matches.add(unique_match_id)
            
            # Step 2: Check if ANY Mumbai Indians players are in this match
            mi_players_in_match = set()
            teams_in_match = {team1, team2}
            
            # Check team rosters first
            if isinstance(match_info['players'], dict):
                for team, player_list in match_info['players'].items():
                    if isinstance(player_list, list):
                        for player in player_list:
                            if isinstance(player, str) and is_mi_player(player.strip()):
                                canonical_name = get_canonical_player_name(player.strip(), teams_in_match)
                                mi_players_in_match.add(canonical_name)
            
            # If no MI players found in team rosters, check delivery-level data
            if not mi_players_in_match:
                # Quick scan of delivery data to find MI players
                if 'innings' in json_data and isinstance(json_data['innings'], list):
                    for inning in json_data['innings']:
                        if isinstance(inning, dict) and 'overs' in inning:
                            overs_data = inning.get('overs', [])
                            if isinstance(overs_data, list):
                                for over_data in overs_data[:5]:  # Sample first 5 overs for quick check
                                    if isinstance(over_data, dict) and 'deliveries' in over_data:
                                        deliveries = over_data.get('deliveries', [])
                                        if isinstance(deliveries, list):
                                            for delivery in deliveries[:6]:  # Sample first 6 deliveries
                                                if isinstance(delivery, dict):
                                                    batter = delivery.get('batter', '')
                                                    bowler = delivery.get('bowler', '')
                                                    
                                                    if batter and is_mi_player(str(batter).strip()):
                                                        canonical_name = get_canonical_player_name(str(batter).strip(), teams_in_match)
                                                        mi_players_in_match.add(canonical_name)
                                                    if bowler and is_mi_player(str(bowler).strip()):
                                                        canonical_name = get_canonical_player_name(str(bowler).strip(), teams_in_match)
                                                        mi_players_in_match.add(canonical_name)
                                                    
                                                    if mi_players_in_match:  # Found MI players, can proceed
                                                        break
                                                if mi_players_in_match:
                                                    break
                                        if mi_players_in_match:
                                            break
                                if mi_players_in_match:
                                    break
                        if mi_players_in_match:
                            break
            
            # If still no MI players found, skip this match
            if not mi_players_in_match:
                continue
                
            logging.info(f"Found MI players in match {unique_match_id}: {mi_players_in_match}")
            
            # Step 3: Process innings data for detailed statistics
            if 'innings' not in json_data or not json_data['innings']:
                # Even without detailed innings data, create basic match record
                for player_name in mi_players_in_match:
                    match_record = {
                        'player_name': player_name,
                        'match_id': unique_match_id,
                        'team1': team1,
                        'team2': team2,
                        'venue': match_info['venue'],
                        'city': match_info['city'],
                        'date': date_str,
                        'format': match_info['match_type'],
                        'tournament': match_info['event'].get('name', 'Unknown') if isinstance(match_info['event'], dict) else 'Unknown',
                        'season': match_info['season'],
                        'gender': match_info['gender'],
                        'batting_stats': None,
                        'bowling_stats': None,
                        'fielding_stats': None,
                        'match_result': match_info['outcome'].get('winner', 'Unknown') if isinstance(match_info['outcome'], dict) else 'Unknown',
                        'total_deliveries_involved': 0
                    }
                    all_matches.append(match_record)
                continue
                
            innings_data = json_data['innings']
            if not isinstance(innings_data, list):
                continue
            
            # Step 4: Collect all delivery-level data for MI players
            player_delivery_data = {}
            
            # Initialize data structure for each MI player
            for player in mi_players_in_match:
                player_delivery_data[player] = {
                    'batting_deliveries': [],
                    'bowling_deliveries': [],
                    'fielding_deliveries': [],
                    'total_deliveries': 0
                }
            
            # Process each inning
            for inning_idx, inning in enumerate(innings_data):
                if not isinstance(inning, dict) or 'overs' not in inning:
                    continue
                
                inning_team = inning.get('team', 'Unknown')
                overs_data = inning.get('overs', [])
                
                if not isinstance(overs_data, list):
                    continue
                
                # Process each over and delivery
                for over_idx, over_data in enumerate(overs_data):
                    if not isinstance(over_data, dict) or 'deliveries' not in over_data:
                        continue
                    
                    over_number = over_data.get('over', over_idx)
                    deliveries = over_data.get('deliveries', [])
                    
                    if not isinstance(deliveries, list):
                        continue
                    
                    # Process each delivery
                    for delivery_idx, delivery in enumerate(deliveries):
                        if not isinstance(delivery, dict):
                            continue
                        
                        # Extract delivery-level information
                        batter = delivery.get('batter', '')
                        bowler = delivery.get('bowler', '')
                        non_striker = delivery.get('non_striker', '')
                        runs = delivery.get('runs', {})
                        wickets = delivery.get('wickets', [])
                        
                        # Process for each MI player
                        for player in mi_players_in_match:
                            # Check batting
                            if batter and get_canonical_player_name(str(batter).strip(), teams_in_match) == player:
                                player_delivery_data[player]['batting_deliveries'].append({
                                    'runs_batter': runs.get('batter', 0) if isinstance(runs, dict) else 0,
                                    'runs_total': runs.get('total', 0) if isinstance(runs, dict) else 0,
                                    'over': over_number,
                                    'delivery': delivery_idx + 1
                                })
                                player_delivery_data[player]['total_deliveries'] += 1
                            
                            # Check bowling
                            if bowler and get_canonical_player_name(str(bowler).strip(), teams_in_match) == player:
                                player_delivery_data[player]['bowling_deliveries'].append({
                                    'runs_conceded': runs.get('total', 0) if isinstance(runs, dict) else 0,
                                    'wickets': len(wickets) if isinstance(wickets, list) else 0,
                                    'wicket_details': wickets if isinstance(wickets, list) else [],
                                    'over': over_number,
                                    'delivery': delivery_idx + 1
                                })
                                player_delivery_data[player]['total_deliveries'] += 1
                            
                            # Check fielding (in wickets)
                            if isinstance(wickets, list):
                                for wicket in wickets:
                                    if isinstance(wicket, dict):
                                        fielders = wicket.get('fielders', [])
                                        if isinstance(fielders, list):
                                            for fielder in fielders:
                                                if isinstance(fielder, dict):
                                                    fielder_name = fielder.get('name', '')
                                                    if fielder_name and get_canonical_player_name(str(fielder_name).strip(), teams_in_match) == player:
                                                        player_delivery_data[player]['fielding_deliveries'].append({
                                                            'dismissal_type': wicket.get('kind', 'unknown'),
                                                            'over': over_number,
                                                            'delivery': delivery_idx + 1
                                                        })
                                                        canonical_batter = get_canonical_player_name(str(batter).strip(), teams_in_match) if batter else ""
                                                        canonical_bowler = get_canonical_player_name(str(bowler).strip(), teams_in_match) if bowler else ""
                                                        if player not in [canonical_batter, canonical_bowler]:
                                                            player_delivery_data[player]['total_deliveries'] += 1
            
            # Step 5: Create comprehensive match records
            for player, data in player_delivery_data.items():
                # Calculate batting stats
                batting_stats = None
                if data['batting_deliveries']:
                    total_runs = sum(d['runs_batter'] for d in data['batting_deliveries'])
                    total_balls = len(data['batting_deliveries'])
                    fours = len([d for d in data['batting_deliveries'] if d['runs_batter'] == 4])
                    sixes = len([d for d in data['batting_deliveries'] if d['runs_batter'] == 6])
                    dots = len([d for d in data['batting_deliveries'] if d['runs_batter'] == 0])
                    
                    batting_stats = {
                        'runs': total_runs,
                        'balls': total_balls,
                        'fours': fours,
                        'sixes': sixes,
                        'dots': dots,
                        'strike_rate': round((total_runs / total_balls * 100), 2) if total_balls > 0 else 0.0
                    }
                
                # Calculate bowling stats
                bowling_stats = None
                if data['bowling_deliveries']:
                    runs_conceded = sum(d['runs_conceded'] for d in data['bowling_deliveries'])
                    balls_bowled = len(data['bowling_deliveries'])
                    wickets = sum(d['wickets'] for d in data['bowling_deliveries'])
                    dots = len([d for d in data['bowling_deliveries'] if d['runs_conceded'] == 0])
                    
                    bowling_stats = {
                        'runs_conceded': runs_conceded,
                        'balls_bowled': balls_bowled,
                        'wickets': wickets,
                        'dots': dots,
                        'economy': round((runs_conceded / (balls_bowled / 6)), 2) if balls_bowled > 0 else 0.0,
                        'overs': f"{balls_bowled // 6}.{balls_bowled % 6}",
                        'strike_rate': round((balls_bowled / wickets), 2) if wickets > 0 else 0.0
                    }
                
                # Calculate fielding stats - CORRECTED for proper Cricsheet dismissal types
                fielding_stats = None
                if data['fielding_deliveries']:
                    dismissals = data['fielding_deliveries']
                    
                    # Correct parsing based on actual Cricsheet dismissal types
                    catches = len([d for d in dismissals if d['dismissal_type'].lower() == 'caught'])
                    run_outs = len([d for d in dismissals if d['dismissal_type'].lower() == 'run out'])
                    stumpings = len([d for d in dismissals if d['dismissal_type'].lower() == 'stumped'])
                    
                    # Other fielding-related dismissals
                    other_fielding = len([d for d in dismissals if d['dismissal_type'].lower() in ['hit wicket', 'obstructing the field']])
                    
                    fielding_stats = {
                        'catches': catches,
                        'run_outs': run_outs, 
                        'stumpings': stumpings,
                        'other_fielding': other_fielding,
                        'total_dismissals': len(dismissals)
                    }
                    
                    # Debug output for verification
                    if catches > 0 or run_outs > 0 or stumpings > 0:
                        print(f"FIELDING STATS for {player}: Catches={catches}, Run outs={run_outs}, Stumpings={stumpings}, Total={len(dismissals)}")
                
                # Create comprehensive match record
                match_record = {
                    'player_name': player,
                    'match_id': unique_match_id,
                    'team1': team1,
                    'team2': team2,
                    'venue': match_info['venue'],
                    'city': match_info['city'],
                    'date': date_str,
                    'format': match_info['match_type'],
                    'tournament': match_info['event'].get('name', 'Unknown') if isinstance(match_info['event'], dict) else 'Unknown',
                    'season': match_info['season'],
                    'gender': match_info['gender'],
                    'batting_stats': batting_stats,
                    'bowling_stats': bowling_stats,
                    'fielding_stats': fielding_stats,
                    'match_result': match_info['outcome'].get('winner', 'Unknown') if isinstance(match_info['outcome'], dict) else 'Unknown',
                    'total_deliveries_involved': data['total_deliveries']
                }
                
                all_matches.append(match_record)
            
        except Exception as e:
            logging.error(f"Error processing JSON file {idx}: {e}")
            continue
    
    logging.info(f"Comprehensive analysis completed: {len(all_matches)} match records extracted from {len(json_files)} files")
    return all_matches

async def download_and_process_cricsheet_data():
    """Download and process ALL comprehensive Cricsheet data - extract EVERYTHING"""
    try:
        # Comprehensive URLs for ALL cricket formats
        urls = [
            # Year-based data (most comprehensive) - PRIORITY
            "https://cricsheet.org/downloads/2025_male_json.zip",
            "https://cricsheet.org/downloads/2024_male_json.zip",
            
            # Format-specific data for comprehensive coverage
            "https://cricsheet.org/downloads/tests_male_json.zip",        # Test matches
            "https://cricsheet.org/downloads/odis_male_json.zip",         # ODI matches  
            "https://cricsheet.org/downloads/t20s_male_json.zip",         # T20 Internationals
            "https://cricsheet.org/downloads/it20s_male_json.zip",        # Non-official T20Is
            
            # Major tournaments and leagues
            "https://cricsheet.org/downloads/ipl_male_json.zip",          # Indian Premier League
            "https://cricsheet.org/downloads/bbl_male_json.zip",          # Big Bash League
            "https://cricsheet.org/downloads/cpl_male_json.zip",          # Caribbean Premier League
            "https://cricsheet.org/downloads/psl_male_json.zip",          # Pakistan Super League
            "https://cricsheet.org/downloads/bpl_male_json.zip",          # Bangladesh Premier League
            "https://cricsheet.org/downloads/lpl_male_json.zip",          # Lanka Premier League
            "https://cricsheet.org/downloads/sat_male_json.zip",          # SA20
            "https://cricsheet.org/downloads/mlc_male_json.zip",          # Major League Cricket
            "https://cricsheet.org/downloads/ilt_male_json.zip",          # International League T20
            
            # Domestic competitions  
            "https://cricsheet.org/downloads/ntb_male_json.zip",          # T20 Blast (England)
            "https://cricsheet.org/downloads/rlc_male_json.zip",          # One-Day Cup (England)
            "https://cricsheet.org/downloads/cch_male_json.zip",          # County Championship
            "https://cricsheet.org/downloads/ssh_male_json.zip",          # Sheffield Shield (Australia)
            "https://cricsheet.org/downloads/ssm_male_json.zip",          # Super Smash (New Zealand)
            "https://cricsheet.org/downloads/sma_male_json.zip",          # Syed Mushtaq Ali Trophy (India)
        ]
        
        all_cricket_data = []
        successful_downloads = 0
        total_files_processed = 0
        
        for url in urls:
            try:
                logging.info(f"Downloading data from {url}")
                response = requests.get(url, timeout=600)  # 10 minute timeout for large files
                
                if response.status_code == 200:
                    successful_downloads += 1
                    # Extract ZIP file
                    with zipfile.ZipFile(BytesIO(response.content)) as zip_file:
                        # Process ALL JSON files - NO LIMIT
                        json_files = [f for f in zip_file.namelist() if f.endswith('.json')]
                        logging.info(f"Found {len(json_files)} JSON files in {url}")
                        
                        # Process ALL files, not just a sample
                        for json_file in json_files:
                            try:
                                with zip_file.open(json_file) as file:
                                    cricket_match = json.load(file)
                                    all_cricket_data.append(cricket_match)
                                    total_files_processed += 1
                                    
                                    # Log progress every 500 files
                                    if total_files_processed % 500 == 0:
                                        logging.info(f"Processed {total_files_processed} JSON files so far...")
                                        
                            except Exception as e:
                                logging.error(f"Error processing {json_file}: {e}")
                                continue
                                
                    logging.info(f"Successfully processed {len(json_files)} matches from {url}")
                    
                    # Process data in batches to avoid memory issues
                    if len(all_cricket_data) > 1000:
                        logging.info(f"Processing batch of {len(all_cricket_data)} matches...")
                        batch_matches = process_cricket_data(all_cricket_data)
                        
                        if batch_matches:
                            # Save batch to database
                            await db.matches.insert_many([MatchData(**record).dict() for record in batch_matches])
                            logging.info(f"Saved {len(batch_matches)} matches to database")
                        
                        # Clear batch from memory
                        all_cricket_data = []
                        
                else:
                    logging.warning(f"Failed to download {url}: {response.status_code}")
                    
            except Exception as e:
                logging.error(f"Error downloading {url}: {e}")
                continue
        
        # Process remaining data
        if all_cricket_data:
            logging.info(f"Processing final batch of {len(all_cricket_data)} cricket matches")
            final_batch_matches = process_cricket_data(all_cricket_data)
            
            if final_batch_matches:
                await db.matches.insert_many([MatchData(**record).dict() for record in final_batch_matches])
                logging.info(f"Saved final batch of {len(final_batch_matches)} matches to database")
        
        # Get final statistics
        total_matches = await db.matches.count_documents({})
        unique_players = len(await db.matches.distinct("player_name"))
        unique_tournaments = len(await db.matches.distinct("tournament"))
        unique_formats = set(await db.matches.distinct("format"))
        
        # Update sync status
        sync_status = DataSyncStatus(
            status="completed",
            last_sync=datetime.utcnow(),
            total_matches=total_matches,
            total_players=unique_players,
            message=f"Successfully processed ALL data: {total_matches} matches across {unique_tournaments} tournaments and {len(unique_formats)} formats from {successful_downloads} datasets. Processed {total_files_processed} JSON files."
        )
        await db.sync_status.delete_many({})
        await db.sync_status.insert_one(sync_status.dict())
        
        logging.info(f"COMPREHENSIVE DATA SYNC COMPLETED: {total_matches} matches, {unique_players} players, {unique_tournaments} tournaments from {total_files_processed} files")
        return {"success": True, "message": f"Processed ALL available data: {total_matches} matches from {total_files_processed} JSON files across ALL formats"}
            
    except Exception as e:
        logging.error(f"Error in comprehensive data sync: {e}")
        return {"success": False, "message": f"Error: {str(e)}"}

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Mumbai Indians Player Tracker API"}

@api_router.post("/sync-data")
async def sync_cricket_data():
    """Lightweight data synchronization - just cleanup existing data"""
    try:
        # Update sync status to "running"
        sync_status = DataSyncStatus(
            status="running",
            last_sync=datetime.utcnow(),
            message="Running data cleanup and validation..."
        )
        await db.sync_status.delete_many({})
        await db.sync_status.insert_one(sync_status.dict())
        
        # Step 1: Clean up existing duplicates and standardize names
        logging.info("Step 1: Cleaning up duplicate players...")
        updated_matches = await cleanup_duplicate_players()
        
        # Step 2: Remove incorrect Rohit Sharma matches (Singapore/Bahrain etc.)
        logging.info("Step 2: Cleaning up incorrect Rohit Sharma matches...")
        incorrect_rohit_matches = await db.matches.delete_many({
            "player_name": "Rohit Sharma",
            "$and": [
                {"team1": {"$nin": ["Mumbai Indians", "India"]}},
                {"team2": {"$nin": ["Mumbai Indians", "India"]}}
            ]
        })
        
        # Get final statistics
        total_matches = await db.matches.count_documents({})
        unique_players = len(await db.matches.distinct("player_name"))
        
        # Update final sync status
        final_sync_status = DataSyncStatus(
            status="completed",
            last_sync=datetime.utcnow(),
            message=f"Data cleanup completed! {updated_matches} records updated, {incorrect_rohit_matches.deleted_count} incorrect matches removed. Database contains {total_matches} matches for {unique_players} players."
        )
        await db.sync_status.replace_one({}, final_sync_status.dict(), upsert=True)
        
        return {
            "success": True,
            "message": f"Data sync completed successfully! Updated {updated_matches} records, removed {incorrect_rohit_matches.deleted_count} incorrect matches.",
            "total_matches": total_matches,
            "unique_players": unique_players
        }
        
    except Exception as e:
        # Update sync status to "error"
        error_status = DataSyncStatus(
            status="error",
            last_sync=datetime.utcnow(),
            message=f"Data sync failed: {str(e)}"
        )
        await db.sync_status.replace_one({}, error_status.dict(), upsert=True)
        
        logging.error(f"Error in data sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/sync-data-full")
async def sync_cricket_data_full():
    """Full data synchronization - download latest Cricsheet data"""
    try:
        result = await download_and_process_cricsheet_data()
        return result
    except Exception as e:
        logging.error(f"Error in full data sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/cleanup-duplicates")
async def cleanup_duplicate_players_endpoint():
    """Manually trigger duplicate player cleanup"""
    try:
        updated_count = await cleanup_duplicate_players()
        
        # Get updated statistics
        total_matches = await db.matches.count_documents({})
        unique_players = len(await db.matches.distinct("player_name"))
        
        return {
            "success": True,
            "message": f"Cleanup completed! Updated {updated_count} records. Current: {total_matches} matches, {unique_players} unique players",
            "updated_records": updated_count,
            "total_matches": total_matches,
            "unique_players": unique_players
        }
        
    except Exception as e:
        logging.error(f"Error in cleanup endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/players")
async def get_players():
    """Get all Mumbai Indians players with canonical names"""
    try:
        # Get unique players from matches with match counts
        pipeline = [
            {"$group": {"_id": "$player_name", "match_count": {"$sum": 1}}},
            {"$sort": {"match_count": -1}}
        ]
        
        player_stats = await db.matches.aggregate(pipeline).to_list(100)
        
        players = []
        existing_names = set()
        
        # Add players with match data (these have canonical names)
        for stat in player_stats:
            if stat["_id"] not in existing_names:
                player = Player(
                    name=stat["_id"],
                    team="Mumbai Indians",
                    active=True
                )
                players.append(player)
                existing_names.add(stat["_id"])
        
        # Add players without match data (from MI_PLAYERS list)
        for mi_player in MI_PLAYERS:
            if mi_player not in existing_names:
                player = Player(
                    name=mi_player,
                    team="Mumbai Indians", 
                    active=True
                )
                players.append(player)
                existing_names.add(mi_player)
        
        return players
        
    except Exception as e:
        logging.error(f"Error getting players: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/players/{player_id}/matches")
async def get_player_matches(player_id: str, limit: int = 50):
    """Get matches for a specific player"""
    try:
        # Find player by name (using player_id as name for simplicity)
        matches = await db.matches.find(
            {"player_name": {"$regex": player_id, "$options": "i"}},
            limit=limit
        ).sort("date", -1).to_list(limit)
        
        return [MatchData(**match) for match in matches]
        
    except Exception as e:
        logging.error(f"Error getting player matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/matches")
async def get_all_matches(limit: int = 100, player: Optional[str] = None):
    """Get all matches with optional player filter"""
    try:
        query = {}
        if player:
            query["player_name"] = {"$regex": player, "$options": "i"}
        
        matches = await db.matches.find(query, limit=limit).sort("date", -1).to_list(limit)
        return [MatchData(**match) for match in matches]
        
    except Exception as e:
        logging.error(f"Error getting matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/matches/unique")
async def get_unique_matches(
    limit: int = 100, 
    player: Optional[str] = None,
    format: Optional[str] = None,
    tournament: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get unique matches (one per game) with player performance data"""
    try:
        # Build base query for filtering
        base_query = {}
        if format:
            base_query["format"] = {"$regex": format, "$options": "i"}
        if tournament:
            base_query["tournament"] = {"$regex": tournament, "$options": "i"}
        if date_from or date_to:
            date_query = {}
            if date_from:
                date_query["$gte"] = date_from
            if date_to:
                date_query["$lte"] = date_to
            base_query["date"] = date_query

        # Aggregation pipeline to get unique matches with player data
        pipeline = [
            {"$match": base_query},
            {
                "$group": {
                    "_id": "$match_id",
                    "date": {"$first": "$date"},
                    "team1": {"$first": "$team1"},
                    "team2": {"$first": "$team2"},
                    "venue": {"$first": "$venue"},
                    "city": {"$first": "$city"},
                    "format": {"$first": "$format"},
                    "tournament": {"$first": "$tournament"},
                    "season": {"$first": "$season"},
                    "match_result": {"$first": "$match_result"},
                    "players": {
                        "$push": {
                            "player_name": "$player_name",
                            "batting_stats": "$batting_stats",
                            "bowling_stats": "$bowling_stats",
                            "fielding_stats": "$fielding_stats"
                        }
                    }
                }
            },
            {"$sort": {"date": -1}},
            {"$limit": limit}
        ]
        
        # If player filter is specified, add it to the pipeline
        if player:
            pipeline.insert(0, {
                "$match": {
                    **base_query,
                    "player_name": {"$regex": player, "$options": "i"}
                }
            })
        
        unique_matches = await db.matches.aggregate(pipeline).to_list(limit)
        
        # Format the response
        formatted_matches = []
        for match in unique_matches:
            # Filter to only include MI players if player filter is applied
            players_data = match.get('players', [])
            if player:
                players_data = [p for p in players_data if player.lower() in p['player_name'].lower()]
            
            formatted_match = {
                "match_id": match["_id"],
                "date": match["date"],
                "team1": match["team1"],
                "team2": match["team2"],
                "venue": match["venue"],
                "city": match["city"],
                "format": match["format"],
                "tournament": match["tournament"],
                "season": match["season"],
                "match_result": match["match_result"],
                "players_performance": players_data
            }
            formatted_matches.append(formatted_match)
        
        return formatted_matches
        
    except Exception as e:
        logging.error(f"Error getting unique matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/sync-status")
async def get_sync_status():
    """Get data synchronization status"""
    try:
        status = await db.sync_status.find_one()
        if status:
            return DataSyncStatus(**status)
        else:
            return DataSyncStatus(
                status="not_started",
                last_sync=datetime.utcnow(),
                message="Data sync not started yet"
            )
    except Exception as e:
        logging.error(f"Error getting sync status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics")
async def get_analytics_data(
    player: Optional[str] = None,
    format: Optional[str] = None,
    tournament: Optional[str] = None,
    season: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get comprehensive analytics data with advanced filtering"""
    try:
        # Build query based on filters
        query = {}
        
        if player:
            query["player_name"] = {"$regex": player, "$options": "i"}
        if format:
            query["format"] = {"$regex": format, "$options": "i"}
        if tournament:
            query["tournament"] = {"$regex": tournament, "$options": "i"}
        if season:
            query["season"] = {"$regex": season, "$options": "i"}
        
        # Date filtering with improved date parsing
        if date_from or date_to:
            date_query = {}
            if date_from:
                date_query["$gte"] = date_from
            if date_to:
                date_query["$lte"] = date_to
            query["date"] = date_query
        
        # Get matches with filters, sorted by date descending
        matches = await db.matches.find(query).sort("date", -1).to_list(2000)  # Increased limit for comprehensive analysis
        
        if not matches:
            return {"players": [], "summary": {}}
        
        # Group matches by player for analytics
        player_analytics = {}
        
        for match in matches:
            player_name = match['player_name']
            
            if player_name not in player_analytics:
                player_analytics[player_name] = {
                    'player_name': player_name,
                    'total_matches': 0,
                    'batting': {
                        'innings': 0,
                        'runs': 0,
                        'balls': 0,
                        'fours': 0,
                        'sixes': 0,
                        'dots': 0,
                        'highest_score': 0,
                        'not_outs': 0,
                        'centuries': 0,
                        'half_centuries': 0,
                        'ducks': 0
                    },
                    'bowling': {
                        'innings': 0,
                        'runs_conceded': 0,
                        'balls_bowled': 0,
                        'wickets': 0,
                        'dots': 0,
                        'best_figures': '0/0',
                        'five_wickets': 0,
                        'four_wickets': 0
                    },
                    'fielding': {
                        'catches': 0,
                        'run_outs': 0,
                        'stumpings': 0,
                        'other_fielding': 0,
                        'total_dismissals': 0
                    },
                    'formats': set(),
                    'tournaments': set(),
                    'seasons': set(),
                    'venues': set(),
                    'recent_form': []  # Last 5 matches performance
                }
            
            analytics = player_analytics[player_name]
            analytics['total_matches'] += 1
            analytics['formats'].add(match.get('format', 'Unknown'))
            analytics['tournaments'].add(match.get('tournament', 'Unknown'))
            analytics['seasons'].add(match.get('season', 'Unknown'))
            analytics['venues'].add(match.get('venue', 'Unknown'))
            
            # Batting analytics
            batting_stats = match.get('batting_stats')
            if batting_stats:
                analytics['batting']['innings'] += 1
                runs = batting_stats.get('runs', 0)
                balls = batting_stats.get('balls', 0)
                analytics['batting']['runs'] += runs
                analytics['batting']['balls'] += balls
                analytics['batting']['fours'] += batting_stats.get('fours', 0)
                analytics['batting']['sixes'] += batting_stats.get('sixes', 0)
                analytics['batting']['dots'] += batting_stats.get('dots', 0)
                
                if runs > analytics['batting']['highest_score']:
                    analytics['batting']['highest_score'] = runs
                
                if runs == 0 and balls > 0:
                    analytics['batting']['ducks'] += 1
                elif runs >= 100:
                    analytics['batting']['centuries'] += 1
                elif runs >= 50:
                    analytics['batting']['half_centuries'] += 1
            
            # Bowling analytics
            bowling_stats = match.get('bowling_stats')
            if bowling_stats:
                analytics['bowling']['innings'] += 1
                runs_conceded = bowling_stats.get('runs_conceded', 0)
                balls_bowled = bowling_stats.get('balls_bowled', 0)
                wickets = bowling_stats.get('wickets', 0)
                
                analytics['bowling']['runs_conceded'] += runs_conceded
                analytics['bowling']['balls_bowled'] += balls_bowled
                analytics['bowling']['wickets'] += wickets
                analytics['bowling']['dots'] += bowling_stats.get('dots', 0)
                
                # Best bowling figures
                current_best = analytics['bowling']['best_figures']
                if current_best == '0/0' or wickets > int(current_best.split('/')[0]):
                    analytics['bowling']['best_figures'] = f"{wickets}/{runs_conceded}"
                
                if wickets >= 5:
                    analytics['bowling']['five_wickets'] += 1
                elif wickets >= 4:
                    analytics['bowling']['four_wickets'] += 1
            
            # Fielding analytics - Updated to include other_fielding
            fielding_stats = match.get('fielding_stats')
            if fielding_stats:
                analytics['fielding']['catches'] += fielding_stats.get('catches', 0)
                analytics['fielding']['run_outs'] += fielding_stats.get('run_outs', 0)
                analytics['fielding']['stumpings'] += fielding_stats.get('stumpings', 0)
                analytics['fielding']['other_fielding'] = analytics['fielding'].get('other_fielding', 0) + fielding_stats.get('other_fielding', 0)
                analytics['fielding']['total_dismissals'] += fielding_stats.get('total_dismissals', 0)
            
            # Recent form (simplified) - only keep first 5 for each player
            if len(analytics['recent_form']) < 5:
                form_data = {
                    'date': match.get('date'),
                    'tournament': match.get('tournament'),
                    'batting_runs': batting_stats.get('runs', 0) if batting_stats else None,
                    'bowling_wickets': bowling_stats.get('wickets', 0) if bowling_stats else None,
                    'match_result': match.get('match_result')
                }
                analytics['recent_form'].append(form_data)
        
        # Calculate derived statistics
        for player_name, analytics in player_analytics.items():
            # Convert sets to lists for JSON serialization
            analytics['formats'] = list(analytics['formats'])
            analytics['tournaments'] = list(analytics['tournaments'])
            analytics['seasons'] = list(analytics['seasons'])
            analytics['venues'] = list(analytics['venues'])
            
            # Batting averages
            batting = analytics['batting']
            if batting['innings'] > 0:
                effective_innings = batting['innings'] - batting['not_outs']
                batting['average'] = round(batting['runs'] / effective_innings, 2) if effective_innings > 0 else 0.0
                batting['strike_rate'] = round((batting['runs'] / batting['balls']) * 100, 2) if batting['balls'] > 0 else 0.0
                batting['boundary_percentage'] = round(((batting['fours'] + batting['sixes']) / batting['balls']) * 100, 2) if batting['balls'] > 0 else 0.0
            else:
                batting['average'] = 0.0
                batting['strike_rate'] = 0.0
                batting['boundary_percentage'] = 0.0
            
            # Bowling averages
            bowling = analytics['bowling']
            if bowling['innings'] > 0:
                bowling['average'] = round(bowling['runs_conceded'] / bowling['wickets'], 2) if bowling['wickets'] > 0 else 0.0
                bowling['economy'] = round((bowling['runs_conceded'] / (bowling['balls_bowled'] / 6)), 2) if bowling['balls_bowled'] > 0 else 0.0
                bowling['strike_rate'] = round(bowling['balls_bowled'] / bowling['wickets'], 2) if bowling['wickets'] > 0 else 0.0
                bowling['dot_ball_percentage'] = round((bowling['dots'] / bowling['balls_bowled']) * 100, 2) if bowling['balls_bowled'] > 0 else 0.0
                bowling['overs'] = f"{bowling['balls_bowled'] // 6}.{bowling['balls_bowled'] % 6}"
            else:
                bowling['average'] = 0.0
                bowling['economy'] = 0.0
                bowling['strike_rate'] = 0.0
                bowling['dot_ball_percentage'] = 0.0
                bowling['overs'] = "0.0"
        
        # Generate summary statistics
        total_matches = len(matches)
        unique_players = len(player_analytics)
        formats_covered = len(set([m.get('format', 'Unknown') for m in matches]))
        tournaments_covered = len(set([m.get('tournament', 'Unknown') for m in matches]))
        
        summary = {
            'total_matches': total_matches,
            'unique_players': unique_players,
            'formats_covered': formats_covered,
            'tournaments_covered': tournaments_covered,
            'date_range': {
                'from': min([m.get('date', '') for m in matches]) if matches else '',
                'to': max([m.get('date', '') for m in matches]) if matches else ''
            }
        }
        
        return {
            'players': list(player_analytics.values()),
            'summary': summary
        }
        
    except Exception as e:
        logging.error(f"Error getting analytics data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics/filters")
async def get_analytics_filters():
    """Get available filter options for analytics"""
    try:
        # Get unique values for filters
        formats = await db.matches.distinct("format")
        tournaments = await db.matches.distinct("tournament")
        seasons = await db.matches.distinct("season")
        players = await db.matches.distinct("player_name")
        
        # Get date range
        date_pipeline = [
            {"$group": {
                "_id": None,
                "min_date": {"$min": "$date"},
                "max_date": {"$max": "$date"}
            }}
        ]
        date_range = await db.matches.aggregate(date_pipeline).to_list(1)
        
        return {
            'formats': [f for f in formats if f and f != 'Unknown'],
            'tournaments': [t for t in tournaments if t and t != 'Unknown'],
            'seasons': [s for s in seasons if s and s != 'Unknown'],
            'players': [p for p in players if p],
            'date_range': {
                'min': date_range[0]['min_date'] if date_range else '',
                'max': date_range[0]['max_date'] if date_range else ''
            }
        }
        
    except Exception as e:
        logging.error(f"Error getting analytics filters: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/stats")
async def get_stats():
    """Get overall statistics"""
    try:
        total_matches = await db.matches.count_documents({})
        total_players = len(await db.matches.distinct("player_name"))
        
        # Recent matches
        recent_matches = await db.matches.find().sort("date", -1).limit(5).to_list(5)
        
        return {
            "total_matches": total_matches,
            "total_players": total_players,
            "recent_matches": len(recent_matches),
            "last_updated": datetime.utcnow()
        }
    except Exception as e:
        logging.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
