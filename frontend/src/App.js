import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Progress } from './components/ui/progress';
import { Alert, AlertDescription } from './components/ui/alert';
import { Users, BarChart3, Calendar, Zap, Download, Loader2, TrendingUp, Filter, Target, Award, FileDown } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState({});
  const [syncStatus, setSyncStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState({ players: [], summary: {} });
  const [analyticsFilters, setAnalyticsFilters] = useState({});
  const [selectedFilters, setSelectedFilters] = useState({
    player: '',
    format: '',
    tournament: '',
    season: '',
    date_from: '',
    date_to: ''
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  // Player selection for export - independent of filters
  const [allPlayersForSelection, setAllPlayersForSelection] = useState([]);
  const [selectedPlayersForExport, setSelectedPlayersForExport] = useState([]);
  const [showPlayerSelection, setShowPlayerSelection] = useState(false);
  const [playersSelectionLoading, setPlayersSelectionLoading] = useState(false);
  // Player selection specific filters
  const [playerSelectionFilters, setPlayerSelectionFilters] = useState({
    format: '',
    tournament: '',
    date_from: '',
    date_to: ''
  });

  useEffect(() => {
    loadInitialData();
    // Load all players initially without any filters
    const initialLoad = async () => {
      try {
        const response = await axios.get(`${API}/analytics`);
        const allPlayersData = response.data.players || [];
        const sortedPlayers = sortPlayersByOrder([...allPlayersData]);
        setAllPlayersForSelection(sortedPlayers);
      } catch (error) {
        console.error('Error loading initial players:', error);
      }
    };
    initialLoad();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadPlayers(),
        loadStats(),
        loadSyncStatus(),
        loadRecentMatches(),
        loadAnalyticsFilters()
      ]);
    } catch (error) {
      setError('Failed to load initial data');
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async () => {
    try {
      const response = await axios.get(`${API}/players`);
      setPlayers(response.data);
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const response = await axios.get(`${API}/sync-status`);
      setSyncStatus(response.data);
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const loadRecentMatches = async () => {
    try {
      const response = await axios.get(`${API}/matches?limit=20`);
      setMatches(response.data);
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  };

  const loadAnalyticsFilters = async () => {
    try {
      const response = await axios.get(`${API}/analytics/filters`);
      setAnalyticsFilters(response.data);
    } catch (error) {
      console.error('Error loading analytics filters:', error);
    }
  };

  const loadAllPlayersForSelection = async () => {
    try {
      setPlayersSelectionLoading(true);
      // Load players based on player selection specific filters
      const params = new URLSearchParams();
      if (playerSelectionFilters.format) params.append('format', playerSelectionFilters.format);
      if (playerSelectionFilters.tournament) params.append('tournament', playerSelectionFilters.tournament);
      if (playerSelectionFilters.date_from) params.append('date_from', playerSelectionFilters.date_from);
      if (playerSelectionFilters.date_to) params.append('date_to', playerSelectionFilters.date_to);
      
      const response = await axios.get(`${API}/analytics?${params.toString()}`);
      const filteredPlayersData = response.data.players || [];
      
      // Sort players by batting order
      const sortedPlayers = sortPlayersByOrder([...filteredPlayersData]);
      setAllPlayersForSelection(sortedPlayers);
      
      // Clear previous selections when filters change
      setSelectedPlayersForExport([]);
      
      console.log(`Loaded ${sortedPlayers.length} players for selection with filters:`, playerSelectionFilters);
    } catch (error) {
      console.error('Error loading players for selection:', error);
    } finally {
      setPlayersSelectionLoading(false);
    }
  };

  const loadAnalyticsData = async (filters = selectedFilters) => {
    try {
      setAnalyticsLoading(true);
      const params = new URLSearchParams();
      
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });

      const response = await axios.get(`${API}/analytics?${params.toString()}`);
      setAnalyticsData(response.data);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      setError('Failed to load analytics data');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadPlayerMatches = async (playerName) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/players/${encodeURIComponent(playerName)}/matches`);
      setMatches(response.data);
    } catch (error) {
      setError('Failed to load player matches');
      console.error('Error loading player matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.post(`${API}/sync-data`);
      
      if (response.data.success) {
        await loadInitialData();
        setError('');
      } else {
        setError(response.data.message || 'Sync failed');
      }
    } catch (error) {
      setError('Failed to sync data');
      console.error('Error syncing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const cleanupDuplicates = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.post(`${API}/cleanup-duplicates`);
      
      if (response.data.success) {
        await loadInitialData();
        setError('');
      } else {
        setError(response.data.message || 'Cleanup failed');
      }
    } catch (error) {
      setError('Failed to cleanup duplicates');
      console.error('Error cleaning up duplicates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerSelect = (playerName) => {
    setSelectedPlayer(playerName);
    if (playerName) {
      loadPlayerMatches(playerName);
    } else {
      loadRecentMatches();
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...selectedFilters, [key]: value };
    setSelectedFilters(newFilters);
  };

  const applyAnalyticsFilters = () => {
    loadAnalyticsData(selectedFilters);
  };

  const applyPlayerSelectionFilters = () => {
    loadAllPlayersForSelection();
  };

  const clearPlayerSelectionFilters = () => {
    setPlayerSelectionFilters({
      format: '',
      tournament: '',
      date_from: '',
      date_to: ''
    });
    // Reload with cleared filters
    setTimeout(() => {
      const params = new URLSearchParams();
      axios.get(`${API}/analytics?${params.toString()}`).then(response => {
        const allPlayersData = response.data.players || [];
        const sortedPlayers = sortPlayersByOrder([...allPlayersData]);
        setAllPlayersForSelection(sortedPlayers);
        setSelectedPlayersForExport([]);
      });
    }, 100);
  };

  const handlePlayerSelectionFilterChange = (key, value) => {
    setPlayerSelectionFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearAnalyticsFilters = () => {
    const clearedFilters = {
      player: '',
      format: '',
      tournament: '',
      season: '',
      date_from: '',
      date_to: ''
    };
    setSelectedFilters(clearedFilters);
    loadAnalyticsData(clearedFilters);
  };

  // Player ordering based on cricket batting positions
  const getPlayerOrder = (playerName) => {
    const openers = ['Rohit Sharma', 'Ryan Rickelton'];
    const topOrder = ['Suryakumar Yadav', 'Tilak Varma', 'Will Jacks'];
    const middleOrder = ['Hardik Pandya', 'Corbin Bosch', 'Naman Dhir', 'Tristan Stubbs'];
    const allRounders = ['Krunal Pandya', 'Shams Mulani', 'Cameron Green'];
    const bowlers = [
      'Jasprit Bumrah', 'Trent Boult', 'Ashwani Kumar', 'Deepak Chahar',
      'Karn Sharma', 'Mitchell Santner', 'Vignesh Puthur', 'Satyanarayana Raju',
      'Arjun Tendulkar', 'Kumar Kartikeya', 'Hrithik Shokeen', 'Ramandeep Singh',
      'Mayank Markande', 'Murugan Ashwin', 'Anmolpreet Singh', 'Akash Madhwal'
    ];
    
    if (openers.includes(playerName)) return { order: 1, role: 'Opener' };
    if (topOrder.includes(playerName)) return { order: 2, role: 'Top Order' };
    if (middleOrder.includes(playerName)) return { order: 3, role: 'Middle Order' };
    if (allRounders.includes(playerName)) return { order: 4, role: 'All-rounder' };
    if (bowlers.includes(playerName)) return { order: 5, role: 'Bowler' };
    return { order: 6, role: 'Other' };
  };

  // Sort players by batting order
  const sortPlayersByOrder = (players) => {
    return players.sort((a, b) => {
      const orderA = getPlayerOrder(a.player_name);
      const orderB = getPlayerOrder(b.player_name);
      
      if (orderA.order === orderB.order) {
        return a.player_name.localeCompare(b.player_name);
      }
      return orderA.order - orderB.order;
    });
  };

  const handlePlayerSelectionForExport = (player, isSelected) => {
    console.log(`Player selection: ${player.player_name}, isSelected: ${isSelected}`);
    console.log('Current selected players:', selectedPlayersForExport.map(p => p.player_name));
    
    setSelectedPlayersForExport(prev => {
      if (isSelected) {
        // Check if player is already selected to avoid duplicates
        const alreadySelected = prev.some(p => p.player_name === player.player_name);
        if (!alreadySelected) {
          console.log('Adding player:', player.player_name);
          return [...prev, player];
        }
        console.log('Player already selected, not adding:', player.player_name);
        return prev;
      } else {
        console.log('Removing player:', player.player_name);
        return prev.filter(p => p.player_name !== player.player_name);
      }
    });
  };

  const selectAllPlayersForExport = () => {
    if (selectedPlayersForExport.length === allPlayersForSelection.length) {
      setSelectedPlayersForExport([]);
    } else {
      setSelectedPlayersForExport([...allPlayersForSelection]);
    }
  };

  // Enhanced Excel export with comprehensive cricket statistics
  const generateExcelReport = async () => {
    try {
      console.log('Starting comprehensive Excel workbook generation...');
      
      // Dynamic import for XLSX library
      const XLSX = await import('xlsx');
      
      console.log('XLSX library loaded successfully');
      
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // 1. EXECUTIVE SUMMARY SHEET
      const summaryData = [
        ['MUMBAI INDIANS - CRICKET ANALYTICS REPORT'],
        ['Generated:', new Date().toLocaleDateString() + ' at ' + new Date().toLocaleTimeString()],
        [''],
        ['APPLIED FILTERS:'],
        ...(selectedFilters.player ? [['Player Focus:', selectedFilters.player]] : []),
        ...(selectedFilters.format ? [['Format:', selectedFilters.format]] : []),
        ...(selectedFilters.tournament ? [['Tournament:', selectedFilters.tournament]] : []),
        ...(selectedFilters.date_from ? [['Date From:', selectedFilters.date_from]] : []),
        ...(selectedFilters.date_to ? [['Date To:', selectedFilters.date_to]] : []),
        [''],
        ['SUMMARY STATISTICS:'],
        ['Total Matches Analyzed:', analyticsData.summary?.total_matches || 0],
        ['Players in Dataset:', analyticsData.summary?.unique_players || 0],
        ['Cricket Formats:', analyticsData.summary?.formats_covered || 0],
        ['Tournaments Covered:', analyticsData.summary?.tournaments_covered || 0],
        ['Date Range:', `${analyticsData.summary?.date_range?.from || 'N/A'} to ${analyticsData.summary?.date_range?.to || 'N/A'}`]
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');
      
      // 2. BATTING STATISTICS SHEET
      if (analyticsData.players && analyticsData.players.length > 0) {
        const battingData = [
          ['MUMBAI INDIANS - BATTING STATISTICS'],
          [''],
          ['Player Name', 'Innings', 'Runs', 'Average', 'Strike Rate', 'Highest Score', 'Centuries', 'Half Centuries', 'Fours', 'Sixes', 'Not Outs', 'Balls Faced', 'Total Matches']
        ];
        
        analyticsData.players.forEach(player => {
          if (player.batting && player.batting.innings > 0) {
            battingData.push([
              player.player_name,
              player.batting.innings || 0,
              player.batting.runs || 0,
              player.batting.average ? parseFloat(player.batting.average).toFixed(2) : 'N/A',
              player.batting.strike_rate ? parseFloat(player.batting.strike_rate).toFixed(2) : 'N/A',
              player.batting.highest_score || 'N/A',
              player.batting.centuries || 0,
              player.batting.half_centuries || 0,
              player.batting.fours || 0,
              player.batting.sixes || 0,
              player.batting.not_outs || 0,
              player.batting.balls_faced || 'N/A',
              player.total_matches || 0
            ]);
          }
        });
        
        const battingSheet = XLSX.utils.aoa_to_sheet(battingData);
        XLSX.utils.book_append_sheet(workbook, battingSheet, 'Batting Statistics');
      }
      
      // 3. BOWLING STATISTICS SHEET
      if (analyticsData.players && analyticsData.players.length > 0) {
        const bowlingData = [
          ['MUMBAI INDIANS - BOWLING STATISTICS'],
          [''],
          ['Player Name', 'Innings', 'Wickets', 'Average', 'Economy', 'Strike Rate', 'Best Figures', '5W Hauls', '4W Hauls', 'Runs Conceded', 'Overs Bowled', 'Maidens', 'Total Matches']
        ];
        
        analyticsData.players.forEach(player => {
          if (player.bowling && player.bowling.innings > 0) {
            bowlingData.push([
              player.player_name,
              player.bowling.innings || 0,
              player.bowling.wickets || 0,
              player.bowling.average ? parseFloat(player.bowling.average).toFixed(2) : 'N/A',
              player.bowling.economy ? parseFloat(player.bowling.economy).toFixed(2) : 'N/A',
              player.bowling.strike_rate ? parseFloat(player.bowling.strike_rate).toFixed(2) : 'N/A',
              player.bowling.best_figures || 'N/A',
              player.bowling.five_wickets || 0,
              player.bowling.four_wickets || 0,
              player.bowling.runs_conceded || 0,
              player.bowling.overs_bowled ? parseFloat(player.bowling.overs_bowled).toFixed(1) : 'N/A',
              player.bowling.maidens || 0,
              player.total_matches || 0
            ]);
          }
        });
        
        const bowlingSheet = XLSX.utils.aoa_to_sheet(bowlingData);
        XLSX.utils.book_append_sheet(workbook, bowlingSheet, 'Bowling Statistics');
      }
      
      // 4. FIELDING STATISTICS SHEET (CORRECTED)
      if (analyticsData.players && analyticsData.players.length > 0) {
        const fieldingData = [
          ['MUMBAI INDIANS - FIELDING STATISTICS'],
          ['Note: Shows dismissals MADE BY each player as a fielder'],
          [''],
          ['Player Name', 'Catches Taken', 'Run Outs Effected', 'Stumpings Made', 'Other Fielding', 'Total Dismissals', 'Fielding Impact', 'Total Matches']
        ];
        
        analyticsData.players.forEach(player => {
          const catches = player.fielding?.catches || 0;
          const runOuts = player.fielding?.run_outs || 0;
          const stumpings = player.fielding?.stumpings || 0;
          const otherFielding = player.fielding?.other_fielding || 0;
          const totalDismissals = player.fielding?.total_dismissals || 0;
          
          const impact = totalDismissals > 25 ? 'Elite Fielder' :
                        totalDismissals > 15 ? 'High Impact' :
                        totalDismissals > 8 ? 'Moderate Impact' :
                        totalDismissals > 3 ? 'Contributing Role' : 
                        totalDismissals > 0 ? 'Supporting Role' : 'No Dismissals';
          
          fieldingData.push([
            player.player_name,
            catches,
            runOuts,
            stumpings,
            otherFielding,
            totalDismissals,
            impact,
            player.total_matches || 0
          ]);
        });
        
        const fieldingSheet = XLSX.utils.aoa_to_sheet(fieldingData);
        XLSX.utils.book_append_sheet(workbook, fieldingSheet, 'Fielding Statistics');
      }
      
      // 5. CAREER INFORMATION SHEET
      if (analyticsData.players && analyticsData.players.length > 0) {
        const careerData = [
          ['MUMBAI INDIANS - CAREER INFORMATION'],
          [''],
          ['Player Name', 'Total Matches', 'Formats Played', 'Tournaments Count', 'Tournament Names', 'Seasons Active', 'Teams Represented']
        ];
        
        analyticsData.players.forEach(player => {
          careerData.push([
            player.player_name,
            player.total_matches || 0,
            player.formats ? player.formats.join(', ') : 'N/A',
            player.tournaments ? player.tournaments.length : 0,
            player.tournaments ? player.tournaments.slice(0, 10).join(', ') + (player.tournaments.length > 10 ? '...' : '') : 'N/A',
            player.seasons ? player.seasons.join(', ') : 'N/A',
            player.teams ? player.teams.join(', ') : 'N/A'
          ]);
        });
        
        const careerSheet = XLSX.utils.aoa_to_sheet(careerData);
        XLSX.utils.book_append_sheet(workbook, careerSheet, 'Career Information');
      }
      
      // 6. PERFORMANCE ANALYSIS SHEET
      if (analyticsData.players && analyticsData.players.length > 0) {
        const analysisData = [
          ['MUMBAI INDIANS - PERFORMANCE ANALYSIS'],
          [''],
          ['Player Name', 'Batting Grade', 'Batting Consistency', 'Strike Rate Category', 'Bowling Grade', 'Economy Control', 'Wicket Taking Ability', 'Fielding Impact', 'Experience Level', 'Overall Assessment']
        ];
        
        analyticsData.players.forEach(player => {
          // Batting assessment
          const avgScore = player.batting?.average ? parseFloat(player.batting.average) : 0;
          const strikeRate = player.batting?.strike_rate ? parseFloat(player.batting.strike_rate) : 0;
          
          let battingGrade = 'Developing';
          if (avgScore > 40 && strikeRate > 130) battingGrade = 'Excellent';
          else if (avgScore > 30 && strikeRate > 120) battingGrade = 'Very Good';
          else if (avgScore > 25 && strikeRate > 110) battingGrade = 'Good';
          
          const battingConsistency = avgScore > 30 ? 'High' : avgScore > 20 ? 'Moderate' : 'Variable';
          const srCategory = strikeRate > 140 ? 'Explosive' : strikeRate > 120 ? 'Aggressive' : 'Steady';
          
          // Bowling assessment
          const economy = player.bowling?.economy ? parseFloat(player.bowling.economy) : 0;
          const bowlingAverage = player.bowling?.average ? parseFloat(player.bowling.average) : 0;
          
          let bowlingGrade = 'Developing';
          if (economy < 7 && bowlingAverage < 25) bowlingGrade = 'Excellent';
          else if (economy < 8 && bowlingAverage < 30) bowlingGrade = 'Very Good';
          else if (economy < 9 && bowlingAverage < 35) bowlingGrade = 'Good';
          
          const economyControl = economy < 7 ? 'Tight' : economy < 8.5 ? 'Good' : 'Expensive';
          const wicketTaking = (player.bowling?.wickets || 0) > 20 ? 'Prolific' : (player.bowling?.wickets || 0) > 10 ? 'Regular' : 'Limited';
          
          // Fielding and experience
          const totalDismissals = player.fielding?.total_dismissals || 0;
          const fieldingImpact = totalDismissals > 15 ? 'High Impact' : totalDismissals > 5 ? 'Moderate Impact' : 'Supporting Role';
          
          const totalMatches = player.total_matches || 0;
          let experienceLevel = 'Newcomer';
          if (totalMatches > 100) experienceLevel = 'Veteran';
          else if (totalMatches > 50) experienceLevel = 'Experienced';
          else if (totalMatches > 20) experienceLevel = 'Established';
          
          // Overall assessment
          let overallAssessment = 'Developing Player';
          if (battingGrade === 'Excellent' || bowlingGrade === 'Excellent') overallAssessment = 'Star Player';
          else if (battingGrade === 'Very Good' && bowlingGrade === 'Very Good') overallAssessment = 'All-Rounder';
          else if (battingGrade === 'Very Good' || bowlingGrade === 'Very Good') overallAssessment = 'Key Player';
          else if (battingGrade === 'Good' || bowlingGrade === 'Good') overallAssessment = 'Regular Player';
          
          analysisData.push([
            player.player_name,
            player.batting?.innings > 0 ? battingGrade : 'N/A',
            player.batting?.innings > 0 ? battingConsistency : 'N/A',
            player.batting?.innings > 0 ? srCategory : 'N/A',
            player.bowling?.innings > 0 ? bowlingGrade : 'N/A',
            player.bowling?.innings > 0 ? economyControl : 'N/A',
            player.bowling?.innings > 0 ? wicketTaking : 'N/A',
            fieldingImpact,
            experienceLevel,
            overallAssessment
          ]);
        });
        
        const analysisSheet = XLSX.utils.aoa_to_sheet(analysisData);
        XLSX.utils.book_append_sheet(workbook, analysisSheet, 'Performance Analysis');
      }
      
      // Generate filename with timestamp and filter info
      const timestamp = new Date().toISOString().split('T')[0];
      const timeStamp = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
      const filterSuffix = selectedFilters.player ? `_${selectedFilters.player.replace(/\s+/g, '_')}` : 
                          selectedFilters.format ? `_${selectedFilters.format}` : 
                          selectedFilters.tournament ? `_${selectedFilters.tournament.replace(/\s+/g, '_')}` : '';
      const filename = `MI_Cricket_Analytics_${timestamp}_${timeStamp}${filterSuffix}.xlsx`;
      
      // Generate and save Excel file
      console.log('Saving comprehensive Excel workbook:', filename);
      XLSX.writeFile(workbook, filename);
      
      console.log(`Excel workbook with ${analyticsData.players?.length || 0} players generated successfully!`);
      return true;
      
    } catch (error) {
      console.error('Excel generation error:', error);
      throw error;
    }
  };

  // Simple test function
  const testPDF = async () => {
    try {
      console.log('Testing simple PDF generation...');
      const jsPDF = (await import('jspdf')).default;
      
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Mumbai Indians Test PDF', 20, 20);
      doc.text('This is a test to verify PDF generation works.', 20, 40);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 60);
      
      doc.save('MI_Test.pdf');
      alert('Test PDF should have downloaded! Check your Downloads folder.');
      
    } catch (error) {
      console.error('Test PDF failed:', error);
      alert(`Test PDF failed: ${error.message}`);
    }
  };

  const exportToPDF = async () => {
    console.log('=== PLAYER-SPECIFIC PDF EXPORT STARTED ===');
    
    try {
      // Check if players are selected, if not use all players as fallback
      let playersToExport = selectedPlayersForExport.length > 0 ? selectedPlayersForExport : allPlayersForSelection || [];
      
      if (playersToExport.length === 0) {
        alert('No players available for export. Please wait for players to load or refresh the page.');
        return;
      }
      
      // Show loading state
      setLoading(true);
      setError('');
      
      await generateGameByGamePDF(playersToExport);
      
      // Success notification
      setTimeout(() => {
        const playerCount = playersToExport.length;
        const playerNames = playersToExport.slice(0, 3).map(p => p.player_name).join(', ');
        const suffix = playersToExport.length > 3 ? ` and ${playersToExport.length - 3} more` : '';
        alert(`Game-by-game tracker PDF generated for ${playerCount} player(s): ${playerNames}${suffix}. Check your Downloads folder.`);
      }, 500);
      
    } catch (error) {
      console.error('Error generating player-specific PDF:', error);
      const errorMessage = `Failed to generate PDF report: ${error.message}`;
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    console.log('=== PLAYER-SPECIFIC EXCEL EXPORT STARTED ===');
    
    try {
      // Check if players are selected, if not use all players as fallback
      let playersToExport = selectedPlayersForExport.length > 0 ? selectedPlayersForExport : allPlayersForSelection || [];
      
      if (playersToExport.length === 0) {
        alert('No players available for export. Please wait for players to load or refresh the page.');
        return;
      }
      
      // Show loading state
      setLoading(true);
      setError('');
      
      await generateGameByGameExcel(playersToExport);
      
      // Success notification
      setTimeout(() => {
        const playerCount = playersToExport.length;
        const playerNames = playersToExport.slice(0, 3).map(p => p.player_name).join(', ');
        const suffix = playersToExport.length > 3 ? ` and ${playersToExport.length - 3} more` : '';
        alert(`Game-by-game tracker Excel generated for ${playerCount} player(s): ${playerNames}${suffix}. Check your Downloads folder.`);
      }, 500);
      
    } catch (error) {
      console.error('Error generating player-specific Excel:', error);
      const errorMessage = `Failed to generate Excel report: ${error.message}`;
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  

  // Game-by-Game PDF Report Generator for Selected Players
  const generateGameByGamePDF = async (selectedPlayers) => {
    try {
      console.log('Starting game-by-game PDF generation for', selectedPlayers.length, 'players...');
      
      // Dynamic import with better error handling
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);
      
      const jsPDF = jsPDFModule.default;
      const autoTable = autoTableModule.default;
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 25;
      const usableWidth = pageWidth - (2 * margin);
      
      // Professional color scheme for Mumbai Indians
      const colors = {
        primary: [0, 47, 108],      // Mumbai Indians Navy Blue
        secondary: [214, 158, 46],   // Gold accent
        accent: [41, 128, 185],      // Light Blue
        success: [39, 174, 96],      // Green
        text: [44, 62, 80],          // Dark gray
        lightGray: [236, 240, 241],  // Light background
        white: [255, 255, 255]
      };
      
      // Sort players by batting order
      const sortedPlayers = sortPlayersByOrder([...selectedPlayers]);
      
      // ============ 1. TITLE PAGE ============
      
      // Header background
      doc.setFillColor(30, 58, 138);
      doc.rect(0, 0, pageWidth, 60, 'F');
      
      // Main title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      const titleText = 'GAME-BY-GAME PERFORMANCE TRACKER';
      const titleWidth = doc.getTextWidth(titleText);
      doc.text(titleText, (pageWidth - titleWidth) / 2, 35);
      
      // Subtitle
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      const subtitleText = 'Mumbai Indians - Individual Player Analysis';
      const subtitleWidth = doc.getTextWidth(subtitleText);
      doc.text(subtitleText, (pageWidth - subtitleWidth) / 2, 50);
      
      // Report metadata
      doc.setTextColor(0, 0, 0);
      let yPos = 80;
      
      // Players included box
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, usableWidth, 40, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, yPos, usableWidth, 40);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Players Included (${sortedPlayers.length}):`, margin + 10, yPos + 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      const playerNames = sortedPlayers.map(p => {
        const role = getPlayerOrder(p.player_name).role;
        return `${p.player_name} (${role})`;
      }).join(', ');
      
      // Split long player names into multiple lines
      const maxWidth = usableWidth - 20;
      const lines = doc.splitTextToSize(playerNames, maxWidth);
      lines.forEach((line, index) => {
        doc.text(line, margin + 10, yPos + 25 + (index * 8));
      });
      
      yPos += 40 + (lines.length * 8);
      
      // Date and filters
      doc.setFillColor(239, 246, 255);
      doc.rect(margin, yPos, usableWidth, 35, 'F');
      doc.setDrawColor(147, 197, 253);
      doc.rect(margin, yPos, usableWidth, 35);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Report Generated:', margin + 10, yPos + 12);
      doc.text('Filters Applied:', margin + 10, yPos + 24);
      
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleDateString() + ' at ' + new Date().toLocaleTimeString(), margin + 80, yPos + 12);
      
      const filterText = selectedFilters.player ? `Player: ${selectedFilters.player}, ` : '';
      const formatText = selectedFilters.format ? `Format: ${selectedFilters.format}, ` : '';
      const tournamentText = selectedFilters.tournament ? `Tournament: ${selectedFilters.tournament}, ` : '';
      const dateText = (selectedFilters.date_from || selectedFilters.date_to) ? 
        `Date: ${selectedFilters.date_from || 'Start'} to ${selectedFilters.date_to || 'End'}` : '';
      const allFilters = (filterText + formatText + tournamentText + dateText).replace(/, $/, '') || 'No filters applied - Full career data';
      
      doc.text(allFilters, margin + 80, yPos + 24);
      
      // ============ 2. INDIVIDUAL PLAYER SECTIONS ============
      
      for (let playerIndex = 0; playerIndex < sortedPlayers.length; playerIndex++) {
        const player = sortedPlayers[playerIndex];
        const playerOrder = getPlayerOrder(player.player_name);
        
        // Get filtered player data if filters are applied
        let filteredPlayerData = player;
        
        // If any filters are applied, fetch filtered analytics for this player
        const hasFilters = selectedFilters.format || selectedFilters.tournament || 
                          selectedFilters.date_from || selectedFilters.date_to;
        
        if (hasFilters) {
          try {
            const playerParams = new URLSearchParams();
            playerParams.append('player', player.player_name);
            if (selectedFilters.format) playerParams.append('format', selectedFilters.format);
            if (selectedFilters.tournament) playerParams.append('tournament', selectedFilters.tournament);
            if (selectedFilters.date_from) playerParams.append('date_from', selectedFilters.date_from);
            if (selectedFilters.date_to) playerParams.append('date_to', selectedFilters.date_to);
            
            const analyticsResponse = await fetch(`${API}/analytics?${playerParams.toString()}`);
            const filteredAnalytics = await analyticsResponse.json();
            
            if (filteredAnalytics.players && filteredAnalytics.players.length > 0) {
              filteredPlayerData = filteredAnalytics.players[0]; // Get filtered stats
              console.log(`Using filtered stats for ${player.player_name}`);
            }
          } catch (error) {
            console.warn(`Could not get filtered analytics for ${player.player_name}, using original data`);
          }
        }
        
        // Start new page for each player (except first)
        if (playerIndex > 0) {
          doc.addPage();
        } else {
          // For first player, just add some space from title page
          yPos = Math.max(yPos + 60, 180);
          if (yPos > pageHeight - 100) {
            doc.addPage();
            yPos = margin;
          }
        }
        
        if (playerIndex === 0 && yPos < 200) yPos = 200;
        if (playerIndex > 0) yPos = margin;
        
        // ============ PLAYER HEADER ============
        doc.setFillColor(30, 58, 138);
        doc.rect(0, yPos - 10, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(filteredPlayerData.player_name, margin, yPos + 10);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        const statsLabel = hasFilters ? 'FILTERED Stats' : 'Career Stats';
        doc.text(`${playerOrder.role} - ${filteredPlayerData.total_matches} Matches (${statsLabel})`, 
                 margin, yPos + 25);
        
        yPos += 50;
        doc.setTextColor(0, 0, 0);
        
        // ============ CAREER SUMMARY (using filtered data) ============
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const summaryTitle = hasFilters ? 'FILTERED STATISTICS SUMMARY' : 'CAREER SUMMARY';
        doc.text(summaryTitle, margin, yPos);
        yPos += 10;
        
        // Summary stats table (using filteredPlayerData)
        const summaryData = [];
        
        // Batting summary
        if (filteredPlayerData.batting && filteredPlayerData.batting.innings > 0) {
          summaryData.push(['BATTING', '', '', '']);
          summaryData.push(['Innings', filteredPlayerData.batting.innings, 'Average', filteredPlayerData.batting.average ? parseFloat(filteredPlayerData.batting.average).toFixed(2) : 'N/A']);
          summaryData.push(['Runs', (filteredPlayerData.batting.runs || 0).toLocaleString(), 'Strike Rate', filteredPlayerData.batting.strike_rate ? parseFloat(filteredPlayerData.batting.strike_rate).toFixed(1) : 'N/A']);
          summaryData.push(['Highest', filteredPlayerData.batting.highest_score || 'N/A', 'Boundaries', `${filteredPlayerData.batting.fours || 0} x 4s, ${filteredPlayerData.batting.sixes || 0} x 6s`]);
          summaryData.push(['', '', '', '']);
        }
        
        // Bowling summary
        if (filteredPlayerData.bowling && filteredPlayerData.bowling.innings > 0) {
          summaryData.push(['BOWLING', '', '', '']);
          summaryData.push(['Innings', filteredPlayerData.bowling.innings, 'Average', filteredPlayerData.bowling.average ? parseFloat(filteredPlayerData.bowling.average).toFixed(2) : 'N/A']);
          summaryData.push(['Wickets', filteredPlayerData.bowling.wickets || 0, 'Economy', filteredPlayerData.bowling.economy ? parseFloat(filteredPlayerData.bowling.economy).toFixed(2) : 'N/A']);
          summaryData.push(['Best Figures', filteredPlayerData.bowling.best_figures || 'N/A', 'Strike Rate', filteredPlayerData.bowling.strike_rate ? parseFloat(filteredPlayerData.bowling.strike_rate).toFixed(1) : 'N/A']);
          summaryData.push(['', '', '', '']);
        }
        
        // Fielding summary
        const totalDismissals = filteredPlayerData.fielding?.total_dismissals || 0;
        if (totalDismissals > 0) {
          summaryData.push(['FIELDING', '', '', '']);
          summaryData.push(['Catches', filteredPlayerData.fielding?.catches || 0, 'Run Outs', filteredPlayerData.fielding?.run_outs || 0]);
          summaryData.push(['Stumpings', filteredPlayerData.fielding?.stumpings || 0, 'Total Dismissals', totalDismissals]);
          summaryData.push(['', '', '', '']);
        }
        
        if (summaryData.length > 0) {
          autoTable(doc, {
            startY: yPos,
            body: summaryData,
            theme: 'plain',
            styles: { 
              fontSize: 9,
              cellPadding: 3
            },
            columnStyles: {
              0: { fontStyle: 'bold', cellWidth: 35 },
              1: { halign: 'right', cellWidth: 35 },
              2: { fontStyle: 'bold', cellWidth: 35 },
              3: { halign: 'right', cellWidth: 35 }
            },
            margin: { left: margin }
          });
          
          yPos = doc.lastAutoTable.finalY + 20;
        }
        
        // ============ MATCH-BY-MATCH BREAKDOWN ============
        // Get unique matches with same filters as career summary
        try {
          console.log(`Fetching filtered matches for ${player.player_name}...`);
          
          // Build query parameters using SAME filters as career summary
          const params = new URLSearchParams();
          params.append('player', player.player_name);
          
          // Apply player selection filters (consistent with career summary)
          if (playerSelectionFilters.format) params.append('format', playerSelectionFilters.format);
          if (playerSelectionFilters.tournament) params.append('tournament', playerSelectionFilters.tournament);
          if (playerSelectionFilters.date_from) params.append('date_from', playerSelectionFilters.date_from);
          if (playerSelectionFilters.date_to) params.append('date_to', playerSelectionFilters.date_to);
          
          // Also apply analytics filters if no player selection filters
          if (!playerSelectionFilters.format && selectedFilters.format) params.append('format', selectedFilters.format);
          if (!playerSelectionFilters.tournament && selectedFilters.tournament) params.append('tournament', selectedFilters.tournament);
          if (!playerSelectionFilters.date_from && selectedFilters.date_from) params.append('date_from', selectedFilters.date_from);
          if (!playerSelectionFilters.date_to && selectedFilters.date_to) params.append('date_to', selectedFilters.date_to);
          
          const matchResponse = await fetch(`${API}/matches/unique?limit=50&${params.toString()}`);
          const uniqueMatches = await matchResponse.json();
          
          if (uniqueMatches && uniqueMatches.length > 0) {
            // Section header with professional styling
            doc.setFillColor(...colors.primary);
            doc.roundedRect(margin, yPos, usableWidth, 20, 3, 3, 'F');
            
            doc.setTextColor(...colors.white);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('MATCH-BY-MATCH PERFORMANCE', margin + 10, yPos + 13);
            
            yPos += 35;
            doc.setTextColor(...colors.text);
            
            // Create professionally formatted table data
            const matchTableData = uniqueMatches.map((match, index) => {
              const playerPerformance = match.players_performance?.find(p => 
                p.player_name.toLowerCase() === player.player_name.toLowerCase()
              ) || {};
              
              const batting = playerPerformance.batting_stats || {};
              const bowling = playerPerformance.bowling_stats || {};
              const fielding = playerPerformance.fielding_stats || {};
              
              return [
                `${index + 1}`,
                match.date ? new Date(match.date).toLocaleDateString('en-US', { 
                  month: 'short', day: 'numeric' 
                }) : 'N/A',
                `${match.team1} v ${match.team2}`,
                match.tournament ? match.tournament.length > 15 ? 
                  match.tournament.substring(0, 15) + '...' : match.tournament : 'N/A',
                match.format || 'N/A',
                match.venue ? match.venue.length > 20 ? 
                  match.venue.substring(0, 20) + '...' : match.venue : 'N/A',
                batting.runs ? `${batting.runs}${batting.balls ? `(${batting.balls})` : ''}` : '-',
                bowling.wickets ? `${bowling.wickets}/${bowling.runs_conceded}${bowling.overs ? ` (${bowling.overs})` : ''}` : '-',
                fielding.total_dismissals > 0 ? 
                  `${fielding.catches || 0}c ${fielding.run_outs || 0}ro ${fielding.stumpings || 0}st` : '-'
              ];
            });
            
            if (matchTableData.length > 0) {
              autoTable(doc, {
                startY: yPos,
                head: [['#', 'Date', 'Match', 'Tournament', 'Format', 'Venue', 'Batting', 'Bowling', 'Fielding']],
                body: matchTableData,
                theme: 'striped',
                headStyles: { 
                  fillColor: colors.primary,
                  textColor: colors.white,
                  fontSize: 8,
                  fontStyle: 'bold',
                  halign: 'center'
                },
                bodyStyles: {
                  fontSize: 7,
                  halign: 'center',
                  textColor: colors.text
                },
                alternateRowStyles: {
                  fillColor: [248, 250, 252]
                },
                columnStyles: {
                  0: { cellWidth: 8, halign: 'center' },
                  1: { cellWidth: 18, fontSize: 6, halign: 'center' },
                  2: { cellWidth: 35, fontSize: 6, halign: 'left' },
                  3: { cellWidth: 22, fontSize: 6, halign: 'center' },
                  4: { cellWidth: 12, fontSize: 6, halign: 'center' },
                  5: { cellWidth: 25, fontSize: 6, halign: 'center' },
                  6: { cellWidth: 18, fontSize: 7, halign: 'center' },
                  7: { cellWidth: 20, fontSize: 7, halign: 'center' },
                  8: { cellWidth: 16, fontSize: 6, halign: 'center' }
                },
                margin: { left: margin, right: margin },
                tableWidth: usableWidth,
                showHead: 'everyPage',
                tableLineColor: colors.primary,
                tableLineWidth: 0.1
              });
              
              yPos = doc.lastAutoTable.finalY + 20;
            }
            
            // Add performance summary box at bottom of matches
            if (yPos < pageHeight - 80) {
              doc.setFillColor(252, 248, 227);
              doc.roundedRect(margin, yPos, usableWidth, 35, 3, 3, 'F');
              doc.setDrawColor(...colors.secondary);
              doc.setLineWidth(1);
              doc.roundedRect(margin, yPos, usableWidth, 35, 3, 3, 'S');
              
              doc.setFontSize(10);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(...colors.secondary);
              doc.text('📈 SUMMARY:', margin + 10, yPos + 12);
              
              doc.setFontSize(9);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(...colors.text);
              
              const totalMatches = matchTableData.length;
              const battingMatches = matchTableData.filter(m => m[6] !== '-').length;
              const bowlingMatches = matchTableData.filter(m => m[7] !== '-').length;
              
              doc.text(`${totalMatches} matches analyzed`, margin + 70, yPos + 12);
              doc.text(`${battingMatches} batting performances`, margin + 70, yPos + 20);
              doc.text(`${bowlingMatches} bowling performances`, margin + 70, yPos + 28);
              
              if (hasFilters || playerSelectionFilters.format || playerSelectionFilters.tournament) {
                doc.text('📋 Filtered data as per export criteria', margin + 200, yPos + 20);
              }
            }
            
          } else {
            // No matches found
            doc.setFillColor(254, 242, 242);
            doc.roundedRect(margin, yPos, usableWidth, 40, 3, 3, 'F');
            doc.setDrawColor(239, 68, 68);
            doc.roundedRect(margin, yPos, usableWidth, 40, 3, 3, 'S');
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(220, 38, 38);
            doc.text('No matches found for current filter criteria', margin + 15, yPos + 20);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text('Try adjusting filters to see match data', margin + 15, yPos + 30);
          }
          
        } catch (error) {
          console.warn(`Could not fetch matches for ${player.player_name}:`, error);
          
          // Error state with professional styling
          doc.setFillColor(254, 242, 242);
          doc.roundedRect(margin, yPos, usableWidth, 30, 3, 3, 'F');
          doc.setDrawColor(239, 68, 68);
          doc.roundedRect(margin, yPos, usableWidth, 30, 3, 3, 'S');
          
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(220, 38, 38);
          doc.text('⚠️ Match data temporarily unavailable', margin + 10, yPos + 20);
          
          yPos += 40;
        }
      }
      
      // ============ PROFESSIONAL FOOTER FOR ALL PAGES ============
      const totalPages = doc.internal.getNumberOfPages();
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        doc.setPage(pageNum);
        
        // Footer background
        doc.setFillColor(...colors.primary);
        doc.rect(0, pageHeight - 25, pageWidth, 25, 'F');
        
        // Footer content
        doc.setTextColor(...colors.white);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        
        // Left side
        doc.text('Mumbai Indians Performance Analytics', margin, pageHeight - 15);
        doc.text('Confidential & Proprietary', margin, pageHeight - 8);
        
        // Center 
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth/2 - 25, pageHeight - 15);
        
        // Right side
        doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 25, pageHeight - 15);
        doc.text('analytics@mumbaiindians.com', pageWidth - margin - 45, pageHeight - 8);
      }
      
      // ============ GENERATE FILENAME AND SAVE ============
      const timestamp = new Date().toISOString().split('T')[0];
      const timeStamp = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      
      let filterSuffix = '';
      if (playerSelectionFilters.format) filterSuffix += `_${playerSelectionFilters.format}`;
      if (playerSelectionFilters.tournament) filterSuffix += `_${playerSelectionFilters.tournament.replace(/\s+/g, '')}`;
      if (!filterSuffix && selectedFilters.format) filterSuffix += `_${selectedFilters.format}`;
      if (!filterSuffix && selectedFilters.tournament) filterSuffix += `_${selectedFilters.tournament.replace(/\s+/g, '')}`;
      
      const playerSuffix = sortedPlayers.length === 1 ? 
        `_${sortedPlayers[0].player_name.replace(/\s+/g, '_')}` : 
        sortedPlayers.length <= 3 ? 
        `_${sortedPlayers.map(p => p.player_name.split(' ')[0]).join('_')}` :
        `_${sortedPlayers.length}Players`;
      
      const filename = `MI_Analytics_Report_${timestamp}_${timeStamp}${playerSuffix}${filterSuffix}.pdf`;
      
      // Save the professional PDF
      doc.save(filename);
      console.log(`Professional analytics report generated: ${filename}`);
      return true;
      
    } catch (error) {
      console.error('Professional PDF generation error:', error);
      throw error;
    }
  };

  // Game-by-Game Excel Report Generator for Selected Players
  const generateGameByGameExcel = async (selectedPlayers) => {
    try {
      console.log('Starting game-by-game Excel generation for', selectedPlayers.length, 'players...');
      
      // Dynamic import for XLSX
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      
      // Sort players by batting order
      const sortedPlayers = sortPlayersByOrder([...selectedPlayers]);
      
      // ============ 1. SUMMARY SHEET ============
      const hasFilters = selectedFilters.format || selectedFilters.tournament || 
                         selectedFilters.date_from || selectedFilters.date_to ||
                         playerSelectionFilters.format || playerSelectionFilters.tournament ||
                         playerSelectionFilters.date_from || playerSelectionFilters.date_to;
      
      const summaryData = [
        ['MUMBAI INDIANS - GAME-BY-GAME TRACKER'],
        ['Generated:', new Date().toLocaleDateString() + ' at ' + new Date().toLocaleTimeString()],
        [''],
        ['PLAYERS INCLUDED:'],
        ...sortedPlayers.map(p => {
          const role = getPlayerOrder(p.player_name).role;
          const statsNote = hasFilters ? ' (Filtered Stats)' : ' (Career Stats)';
          return [`${p.player_name} (${role})`, `${p.total_matches} matches${statsNote}`];
        }),
        [''],
        ['APPLIED FILTERS:'],
        // Player selection filters take priority
        ...(playerSelectionFilters.format ? [['Export Filter - Format:', playerSelectionFilters.format]] : 
            selectedFilters.format ? [['Analytics Filter - Format:', selectedFilters.format]] : []),
        ...(playerSelectionFilters.tournament ? [['Export Filter - Tournament:', playerSelectionFilters.tournament]] : 
            selectedFilters.tournament ? [['Analytics Filter - Tournament:', selectedFilters.tournament]] : []),
        ...(playerSelectionFilters.date_from ? [['Export Filter - Date From:', playerSelectionFilters.date_from]] : 
            selectedFilters.date_from ? [['Analytics Filter - Date From:', selectedFilters.date_from]] : []),
        ...(playerSelectionFilters.date_to ? [['Export Filter - Date To:', playerSelectionFilters.date_to]] : 
            selectedFilters.date_to ? [['Analytics Filter - Date To:', selectedFilters.date_to]] : []),
        ...(!hasFilters ? [['Note:', 'No filters applied - showing full career data']] : [['Note:', 'Statistics reflect applied filters with export filters taking priority']])
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // ============ 2. INDIVIDUAL PLAYER SHEETS ============
      for (const player of sortedPlayers) {
        const playerOrder = getPlayerOrder(player.player_name);
        
        // Get filtered player data using SAME logic as PDF export
        let filteredPlayerData = player;
        const hasAnyFilters = selectedFilters.format || selectedFilters.tournament || 
                             selectedFilters.date_from || selectedFilters.date_to ||
                             playerSelectionFilters.format || playerSelectionFilters.tournament || 
                             playerSelectionFilters.date_from || playerSelectionFilters.date_to;
        
        if (hasAnyFilters) {
          try {
            const playerParams = new URLSearchParams();
            playerParams.append('player', player.player_name);
            
            // Use player selection filters first, then fallback to analytics filters (SAME AS PDF)
            if (playerSelectionFilters.format) playerParams.append('format', playerSelectionFilters.format);
            else if (selectedFilters.format) playerParams.append('format', selectedFilters.format);
            
            if (playerSelectionFilters.tournament) playerParams.append('tournament', playerSelectionFilters.tournament);
            else if (selectedFilters.tournament) playerParams.append('tournament', selectedFilters.tournament);
            
            if (playerSelectionFilters.date_from) playerParams.append('date_from', playerSelectionFilters.date_from);
            else if (selectedFilters.date_from) playerParams.append('date_from', selectedFilters.date_from);
            
            if (playerSelectionFilters.date_to) playerParams.append('date_to', playerSelectionFilters.date_to);
            else if (selectedFilters.date_to) playerParams.append('date_to', selectedFilters.date_to);
            
            const analyticsResponse = await fetch(`${API}/analytics?${playerParams.toString()}`);
            const filteredAnalytics = await analyticsResponse.json();
            
            if (filteredAnalytics.players && filteredAnalytics.players.length > 0) {
              filteredPlayerData = filteredAnalytics.players[0];
            }
          } catch (error) {
            console.warn(`Could not get filtered analytics for ${player.player_name}, using original data`);
          }
        }
        
        // Get unique matches for this player using SAME filters as PDF export
        try {
          const params = new URLSearchParams();
          params.append('player', player.player_name);
          
          // Apply same filter logic as PDF export
          if (playerSelectionFilters.format) params.append('format', playerSelectionFilters.format);
          else if (selectedFilters.format) params.append('format', selectedFilters.format);
          
          if (playerSelectionFilters.tournament) params.append('tournament', playerSelectionFilters.tournament);
          else if (selectedFilters.tournament) params.append('tournament', selectedFilters.tournament);
          
          if (playerSelectionFilters.date_from) params.append('date_from', playerSelectionFilters.date_from);
          else if (selectedFilters.date_from) params.append('date_from', selectedFilters.date_from);
          
          if (playerSelectionFilters.date_to) params.append('date_to', playerSelectionFilters.date_to);
          else if (selectedFilters.date_to) params.append('date_to', selectedFilters.date_to);
          
          const matchResponse = await fetch(`${API}/matches/unique?limit=100&${params.toString()}`);
          const uniqueMatches = await matchResponse.json();
          
          // Create player sheet data
          const statsLabel = hasAnyFilters ? 'FILTERED STATISTICS' : 'CAREER STATISTICS';
          const playerSheetData = [
            [`${filteredPlayerData.player_name.toUpperCase()} - GAME-BY-GAME PERFORMANCE`],
            [`Role: ${playerOrder.role} | Total Matches: ${filteredPlayerData.total_matches} (${statsLabel})`],
            [''],
            // Career Summary
            [statsLabel.replace('STATISTICS', 'SUMMARY')],
            ['Category', 'Innings', 'Key Stats', 'Average/Economy', 'Best Performance'],
          ];
          
          // Batting summary (using filtered data)
          if (filteredPlayerData.batting && filteredPlayerData.batting.innings > 0) {
            playerSheetData.push([
              'Batting',
              filteredPlayerData.batting.innings,
              `${(filteredPlayerData.batting.runs || 0).toLocaleString()} runs`,
              filteredPlayerData.batting.average ? parseFloat(filteredPlayerData.batting.average).toFixed(2) : 'N/A',
              `${filteredPlayerData.batting.highest_score || 'N/A'} (HS)`
            ]);
          }
          
          // Bowling summary (using filtered data)
          if (filteredPlayerData.bowling && filteredPlayerData.bowling.innings > 0) {
            playerSheetData.push([
              'Bowling',
              filteredPlayerData.bowling.innings,
              `${filteredPlayerData.bowling.wickets || 0} wickets`,
              filteredPlayerData.bowling.economy ? parseFloat(filteredPlayerData.bowling.economy).toFixed(2) : 'N/A',
              `${filteredPlayerData.bowling.best_figures || 'N/A'} (BB)`
            ]);
          }
          
          // Fielding summary (using filtered data)
          const totalDismissals = filteredPlayerData.fielding?.total_dismissals || 0;
          if (totalDismissals > 0) {
            playerSheetData.push([
              'Fielding',
              '-',
              `${totalDismissals} dismissals`,
              `${filteredPlayerData.fielding?.catches || 0} catches`,
              `${filteredPlayerData.fielding?.run_outs || 0} run outs`
            ]);
          }
          
          playerSheetData.push(['']); // Empty row
          
          // Match-by-match data
          playerSheetData.push(['MATCH-BY-MATCH BREAKDOWN']);
          playerSheetData.push([
            '#', 'Date', 'Match', 'Tournament', 'Format', 'Venue', 
            'Runs', 'Balls', 'SR', 'Wickets', 'Economy', 'Catches'
          ]);
          
          if (uniqueMatches && uniqueMatches.length > 0) {
            uniqueMatches.forEach((match, index) => {
              const playerPerformance = match.players_performance?.find(p => 
                p.player_name.toLowerCase() === player.player_name.toLowerCase()
              ) || {};
              
              const batting = playerPerformance.batting_stats || {};
              const bowling = playerPerformance.bowling_stats || {};
              const fielding = playerPerformance.fielding_stats || {};
              
              playerSheetData.push([
                index + 1,
                match.date || 'N/A',
                `${match.team1} v ${match.team2}`,
                match.tournament || 'N/A',
                match.format || 'N/A',
                match.venue || match.city || 'N/A',  // Use venue, fallback to city
                batting.runs || '-',
                batting.balls || '-',
                batting.runs && batting.balls ? ((batting.runs / batting.balls) * 100).toFixed(1) : '-',
                bowling.wickets || '-',
                bowling.economy ? parseFloat(bowling.economy).toFixed(2) : '-',
                fielding.catches || '-'
              ]);
            });
          }
          
          // Create sheet for this player
          const playerSheet = XLSX.utils.aoa_to_sheet(playerSheetData);
          
          // Generate unique sheet name (max 31 characters for Excel)
          let sheetName = player.player_name;
          if (sheetName.length > 31) {
            // Use first name + last name initial if too long
            const nameParts = player.player_name.split(' ');
            sheetName = nameParts.length > 1 ? 
              `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}` : 
              nameParts[0].substring(0, 31);
          }
          
          // Ensure uniqueness by adding index if needed
          let finalSheetName = sheetName;
          let counter = 1;
          while (workbook.SheetNames.includes(finalSheetName)) {
            finalSheetName = `${sheetName.substring(0, 28)}${counter}`;
            counter++;
          }
          
          XLSX.utils.book_append_sheet(workbook, playerSheet, finalSheetName);
          
        } catch (error) {
          console.warn(`Could not fetch matches for ${player.player_name}:`, error);
          // Create a basic sheet with summary only
          const basicPlayerData = [
            [`${player.player_name.toUpperCase()} - CAREER SUMMARY`],
            [`Role: ${playerOrder.role} | Total Matches: ${player.total_matches}`],
            [''],
            ['Match data could not be loaded for this player']
          ];
          
          const basicSheet = XLSX.utils.aoa_to_sheet(basicPlayerData);
          
          // Same unique naming logic for error case
          let sheetName = player.player_name;
          if (sheetName.length > 31) {
            const nameParts = player.player_name.split(' ');
            sheetName = nameParts.length > 1 ? 
              `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}` : 
              nameParts[0].substring(0, 31);
          }
          
          let finalSheetName = sheetName;
          let counter = 1;
          while (workbook.SheetNames.includes(finalSheetName)) {
            finalSheetName = `${sheetName.substring(0, 28)}${counter}`;
            counter++;
          }
          
          XLSX.utils.book_append_sheet(workbook, basicSheet, finalSheetName);
        }
      }
      
      // ============ 3. CONSOLIDATED VIEW SHEET ============
      const consolidatedData = [
        ['MUMBAI INDIANS - CONSOLIDATED TRACKER'],
        ['All Selected Players Performance Summary'],
        [''],
        ['Player', 'Role', 'Matches', 'Runs', 'Average', 'Strike Rate', 'Wickets', 'Economy', 'Catches', 'Run Outs']
      ];
      
      sortedPlayers.forEach(player => {
        const role = getPlayerOrder(player.player_name).role;
        consolidatedData.push([
          player.player_name,
          role,
          player.total_matches || 0,
          player.batting?.runs || '-',
          player.batting?.average ? parseFloat(player.batting.average).toFixed(2) : '-',
          player.batting?.strike_rate ? parseFloat(player.batting.strike_rate).toFixed(1) : '-',
          player.bowling?.wickets || '-',
          player.bowling?.economy ? parseFloat(player.bowling.economy).toFixed(2) : '-',
          player.fielding?.catches || '-',
          player.fielding?.run_outs || '-'
        ]);
      });
      
      const consolidatedSheet = XLSX.utils.aoa_to_sheet(consolidatedData);
      XLSX.utils.book_append_sheet(workbook, consolidatedSheet, 'Consolidated');
      
      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const timeStamp = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
      const playerSuffix = sortedPlayers.length === 1 ? 
        `_${sortedPlayers[0].player_name.replace(/\s+/g, '_')}` : 
        sortedPlayers.length <= 3 ? 
        `_${sortedPlayers.map(p => p.player_name.split(' ')[0]).join('_')}` :
        `_${sortedPlayers.length}Players`;
      
      const filename = `MI_GameByGame_${timestamp}_${timeStamp}${playerSuffix}.xlsx`;
      
      // Save Excel file
      XLSX.writeFile(workbook, filename);
      console.log(`Game-by-game Excel report generated: ${filename}`);
      return true;
      
    } catch (error) {
      console.error('Game-by-game Excel generation error:', error);
      throw error;
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getMatchTitle = (match) => {
    return `${match.team1} vs ${match.team2}`;
  };

  const StatCard = ({ title, value, icon: Icon, subtitle }) => (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-0 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <div className="p-3 bg-blue-500 rounded-full">
            <Icon className="h-8 w-8 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const MatchCard = ({ match }) => (
    <Card className="mb-4 hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">{getMatchTitle(match)}</h4>
            <p className="text-sm text-gray-600 mt-1">{match.venue} • {match.city}</p>
            <p className="text-xs text-gray-500">{match.season} • {match.tournament}</p>
          </div>
          <div className="text-right">
            <Badge variant="outline" className="mb-2">{match.format}</Badge>
            <p className="text-sm text-gray-500">{formatDate(match.date)}</p>
            {match.total_deliveries_involved && (
              <p className="text-xs text-blue-500">{match.total_deliveries_involved} deliveries</p>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Player</p>
            <p className="text-lg font-semibold text-blue-600">{match.player_name}</p>
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-700">Batting</p>
            {match.batting_stats ? (
              <div className="text-sm">
                <span className="font-semibold text-green-600">
                  {match.batting_stats.runs}({match.batting_stats.balls})
                </span>
                <div className="text-xs text-gray-500">
                  SR: {match.batting_stats.strike_rate} • 
                  4s: {match.batting_stats.fours} • 
                  6s: {match.batting_stats.sixes}
                </div>
                {match.batting_stats.dots > 0 && (
                  <div className="text-xs text-gray-400">
                    Dots: {match.batting_stats.dots}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-gray-400">Did not bat</span>
            )}
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-700">Bowling</p>
            {match.bowling_stats ? (
              <div className="text-sm">
                <span className="font-semibold text-purple-600">
                  {match.bowling_stats.wickets}/{match.bowling_stats.runs_conceded} ({match.bowling_stats.overs})
                </span>
                <div className="text-xs text-gray-500">
                  Econ: {match.bowling_stats.economy}
                  {match.bowling_stats.strike_rate && ` • SR: ${match.bowling_stats.strike_rate}`}
                </div>
                {match.bowling_stats.dots > 0 && (
                  <div className="text-xs text-gray-400">
                    Dots: {match.bowling_stats.dots}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-gray-400">Did not bowl</span>
            )}
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-700">Fielding</p>
            {match.fielding_stats && match.fielding_stats.total_dismissals > 0 ? (
              <div className="text-sm">
                <span className="font-semibold text-orange-600">
                  {match.fielding_stats.total_dismissals} dismissal(s)
                </span>
                <div className="text-xs text-gray-500">
                  {match.fielding_stats.catches > 0 && `C: ${match.fielding_stats.catches} `}
                  {match.fielding_stats.run_outs > 0 && `RO: ${match.fielding_stats.run_outs} `}
                  {match.fielding_stats.stumpings > 0 && `St: ${match.fielding_stats.stumpings}`}
                </div>
              </div>
            ) : (
              <span className="text-xs text-gray-400">No dismissals</span>
            )}
          </div>
        </div>
        
        {match.match_result && match.match_result !== 'Unknown' && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Result:</span> {match.match_result}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const PlayerAnalyticsCard = ({ player }) => (
    <Card className="mb-6 hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl text-gray-900">{player.player_name}</CardTitle>
          <Badge className="bg-blue-100 text-blue-800">
            {player.total_matches} matches
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Batting Stats */}
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-3 flex items-center">
              <Target className="h-4 w-4 mr-2" />
              Batting
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Innings:</span>
                <span className="font-medium">{player.batting.innings}</span>
              </div>
              <div className="flex justify-between">
                <span>Runs:</span>
                <span className="font-medium">{player.batting.runs}</span>
              </div>
              <div className="flex justify-between">
                <span>Average:</span>
                <span className="font-medium">{player.batting.average}</span>
              </div>
              <div className="flex justify-between">
                <span>Strike Rate:</span>
                <span className="font-medium">{player.batting.strike_rate}</span>
              </div>
              <div className="flex justify-between">
                <span>Highest:</span>
                <span className="font-medium">{player.batting.highest_score}</span>
              </div>
              <div className="flex justify-between">
                <span>100s/50s:</span>
                <span className="font-medium">{player.batting.centuries}/{player.batting.half_centuries}</span>
              </div>
            </div>
          </div>

          {/* Bowling Stats */}
          <div className="p-4 bg-purple-50 rounded-lg">
            <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
              <Zap className="h-4 w-4 mr-2" />
              Bowling
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Innings:</span>
                <span className="font-medium">{player.bowling.innings}</span>
              </div>
              <div className="flex justify-between">
                <span>Wickets:</span>
                <span className="font-medium">{player.bowling.wickets}</span>
              </div>
              <div className="flex justify-between">
                <span>Average:</span>
                <span className="font-medium">{player.bowling.average}</span>
              </div>
              <div className="flex justify-between">
                <span>Economy:</span>
                <span className="font-medium">{player.bowling.economy}</span>
              </div>
              <div className="flex justify-between">
                <span>Strike Rate:</span>
                <span className="font-medium">{player.bowling.strike_rate}</span>
              </div>
              <div className="flex justify-between">
                <span>Best:</span>
                <span className="font-medium">{player.bowling.best_figures}</span>
              </div>
            </div>
          </div>

          {/* Fielding & Career Stats */}
          <div className="p-4 bg-orange-50 rounded-lg">
            <h4 className="font-semibold text-orange-800 mb-3 flex items-center">
              <Award className="h-4 w-4 mr-2" />
              Fielding & Career
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Catches:</span>
                <span className="font-medium">{player.fielding.catches}</span>
              </div>
              <div className="flex justify-between">
                <span>Run Outs:</span>
                <span className="font-medium">{player.fielding.run_outs}</span>
              </div>
              <div className="flex justify-between">
                <span>Stumpings:</span>
                <span className="font-medium">{player.fielding.stumpings}</span>
              </div>
              <div className="flex justify-between">
                <span>Formats:</span>
                <span className="font-medium">{player.formats.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Tournaments:</span>
                <span className="font-medium">{player.tournaments.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Venues:</span>
                <span className="font-medium">{player.venues.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Form */}
        {player.recent_form && player.recent_form.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-3">Recent Form</h4>
            <div className="flex space-x-2">
              {player.recent_form.map((form, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {form.batting_runs !== null ? `${form.batting_runs}` : ''}
                  {form.bowling_wickets !== null ? `${form.bowling_wickets}w` : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading && !players.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-white mb-4" />
          <p className="text-white text-lg">Loading Mumbai Indians Player Tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-600 rounded-full">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Mumbai Indians</h1>
                <p className="text-blue-200">Player Performance Tracker</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={syncData} 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Sync Data
              </Button>
              <Button 
                onClick={cleanupDuplicates} 
                disabled={loading}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Cleanup
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert className="mb-6 bg-red-50 border-red-200">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/10 backdrop-blur-md">
            <TabsTrigger value="dashboard" className="text-white data-[state=active]:bg-blue-600">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="players" className="text-white data-[state=active]:bg-blue-600">
              Players
            </TabsTrigger>
            <TabsTrigger value="matches" className="text-white data-[state=active]:bg-blue-600">
              Matches
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-white data-[state=active]:bg-blue-600">
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Players"
                  value={stats.total_players || 0}
                  icon={Users}
                  subtitle="Active MI Squad"
                />
                <StatCard
                  title="Total Matches"
                  value={stats.total_matches || 0}
                  icon={Calendar}
                  subtitle="Match Records"
                />
                <StatCard
                  title="Data Status"
                  value={syncStatus.status === 'completed' ? 'Updated' : 'Pending'}
                  icon={Zap}
                  subtitle={syncStatus.message}
                />
                <StatCard
                  title="Last Sync"
                  value={syncStatus.last_sync ? formatDate(syncStatus.last_sync) : 'Never'}
                  icon={TrendingUp}
                  subtitle="Data Freshness"
                />
              </div>

              {/* Recent Matches Preview */}
              <Card className="bg-white/95 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Recent Match Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {matches.slice(0, 3).map((match, index) => (
                    <MatchCard key={index} match={match} />
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="players">
            <Card className="bg-white/95 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-gray-900">Mumbai Indians Squad 2025</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {players.map((player, index) => (
                    <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900">{player.name}</h4>
                            <p className="text-sm text-gray-600">{player.team}</p>
                          </div>
                          <Badge variant={player.active ? "default" : "secondary"}>
                            {player.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-3"
                          onClick={() => {
                            handlePlayerSelect(player.name);
                            setActiveTab('matches');
                          }}
                        >
                          View Matches
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matches">
            <Card className="bg-white/95 backdrop-blur-sm">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-gray-900">Match History</CardTitle>
                  <select 
                    value={selectedPlayer} 
                    onChange={(e) => handlePlayerSelect(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Players</option>
                    {players.map((player, index) => (
                      <option key={index} value={player.name}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p>Loading matches...</p>
                  </div>
                ) : matches.length > 0 ? (
                  <div className="space-y-4">
                    {matches.map((match, index) => (
                      <MatchCard key={index} match={match} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No match data available</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Try syncing data or check back later
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="space-y-6">
              {/* Player Selection for Export - MOVED TO TOP */}
              <Card className="bg-white/95 backdrop-blur-sm border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-gray-900 flex items-center justify-between">
                    <div className="flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      Player Selection for Export
                    </div>
                    <div className="text-sm font-normal text-gray-600">
                      {selectedPlayersForExport.length} of {allPlayersForSelection.length} selected
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {playersSelectionLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      <p>Loading players...</p>
                    </div>
                  ) : allPlayersForSelection.length > 0 || playersSelectionLoading ? (
                    <div className="space-y-3">
                      {/* Player Selection Filters */}
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-700">Filter Players for Export</h4>
                          <div className="flex gap-2">
                            <Button 
                              onClick={applyPlayerSelectionFilters}
                              size="sm"
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Apply Filters
                            </Button>
                            <Button 
                              onClick={clearPlayerSelectionFilters}
                              variant="outline" 
                              size="sm"
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              Clear All
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {/* Format Filter */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Format</label>
                            <select
                              value={playerSelectionFilters.format}
                              onChange={(e) => handlePlayerSelectionFilterChange('format', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">All Formats</option>
                              {analyticsFilters.formats?.map((format, index) => (
                                <option key={index} value={format}>{format}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Tournament Filter */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tournament</label>
                            <select
                              value={playerSelectionFilters.tournament}
                              onChange={(e) => handlePlayerSelectionFilterChange('tournament', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">All Tournaments</option>
                              {analyticsFilters.tournaments?.map((tournament, index) => (
                                <option key={index} value={tournament}>{tournament}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Start Date */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                            <input
                              type="date"
                              value={playerSelectionFilters.date_from}
                              onChange={(e) => handlePlayerSelectionFilterChange('date_from', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                              min={analyticsFilters.date_range?.min}
                              max={analyticsFilters.date_range?.max}
                            />
                          </div>
                          
                          {/* End Date */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                            <input
                              type="date"
                              value={playerSelectionFilters.date_to}
                              onChange={(e) => handlePlayerSelectionFilterChange('date_to', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                              min={analyticsFilters.date_range?.min}
                              max={analyticsFilters.date_range?.max}
                            />
                          </div>
                        </div>
                        
                        {/* Filter Status */}
                        {(playerSelectionFilters.format || playerSelectionFilters.tournament || 
                          playerSelectionFilters.date_from || playerSelectionFilters.date_to) && (
                          <div className="text-xs text-blue-600 bg-blue-50 rounded p-2">
                            <strong>Active Filters:</strong>{' '}
                            {playerSelectionFilters.format && `Format: ${playerSelectionFilters.format} `}
                            {playerSelectionFilters.tournament && `Tournament: ${playerSelectionFilters.tournament} `}
                            {playerSelectionFilters.date_from && `From: ${playerSelectionFilters.date_from} `}
                            {playerSelectionFilters.date_to && `To: ${playerSelectionFilters.date_to} `}
                          </div>
                        )}
                      </div>

                      {/* Export Controls */}
                      <div className="flex items-center justify-between pb-2 border-b">
                        <Button 
                          onClick={selectAllPlayersForExport}
                          variant="outline"
                          size="sm"
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                          disabled={playersSelectionLoading}
                        >
                          {selectedPlayersForExport.length === allPlayersForSelection.length ? 'Deselect All' : 'Select All'}
                        </Button>
                        <div className="flex gap-2">
                          <Button 
                            onClick={exportToPDF}
                            disabled={loading}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4 mr-2" />
                            )}
                            {selectedPlayersForExport.length === 0 ? 'Export All Players PDF' : 
                             `Export ${selectedPlayersForExport.length} Player${selectedPlayersForExport.length > 1 ? 's' : ''} PDF`}
                          </Button>
                          <Button 
                            onClick={exportToExcel}
                            disabled={loading}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <FileDown className="h-4 w-4 mr-2" />
                            )}
                            {selectedPlayersForExport.length === 0 ? 'Export All Players Excel' : 
                             `Export ${selectedPlayersForExport.length} Player${selectedPlayersForExport.length > 1 ? 's' : ''} Excel`}
                          </Button>
                        </div>
                      </div>

                      {/* Player Grid - Filtered by Player Selection Filters */}
                      {playersSelectionLoading ? (
                        <div className="text-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                          <p className="text-gray-600">Loading filtered players...</p>
                        </div>
                      ) : allPlayersForSelection.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                          {allPlayersForSelection.map((player, index) => {
                            const isSelected = selectedPlayersForExport.some(p => p.player_name === player.player_name);
                            const playerRole = getPlayerOrder(player.player_name).role;
                            
                            return (
                              <div 
                                key={player.player_name} 
                                className={`relative p-3 rounded-md border cursor-pointer transition-all duration-200 ${
                                  isSelected 
                                    ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' 
                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                }`}
                                onClick={() => handlePlayerSelectionForExport(player, !isSelected)}
                              >
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    readOnly
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                      {player.player_name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {playerRole} • {player.total_matches} matches
                                    </div>
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="absolute top-1 right-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 mb-2">No players match your export filters</p>
                          <Button 
                            onClick={clearPlayerSelectionFilters}
                            variant="outline" 
                            size="sm"
                          >
                            Clear Filters
                          </Button>
                        </div>
                      )}

                      {/* Export Instructions */}
                      {!playersSelectionLoading && (
                        selectedPlayersForExport.length === 0 ? (
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <div className="flex">
                              <div className="ml-3">
                                <h3 className="text-sm font-medium text-blue-800">
                                  Default: Export All Players
                                </h3>
                                <div className="mt-1 text-xs text-blue-700">
                                  No players selected. Export buttons will generate comprehensive game-by-game tracker for all {allPlayersForSelection.length} players, ordered by batting position (openers first).
                                  {(playerSelectionFilters.format || playerSelectionFilters.tournament || 
                                    playerSelectionFilters.date_from || playerSelectionFilters.date_to) && 
                                    ` (Filtered by your export criteria)`
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-green-50 border border-green-200 rounded-md p-3">
                            <div className="flex">
                              <div className="ml-3">
                                <h3 className="text-sm font-medium text-green-800">
                                  Ready to Export Selected Players
                                </h3>
                                <div className="mt-1 text-xs text-green-700">
                                  Generate comprehensive game-by-game tracker with career summaries and match details for {selectedPlayersForExport.length} selected player{selectedPlayersForExport.length > 1 ? 's' : ''}. Available in both PDF and Excel formats.
                                  {(playerSelectionFilters.format || playerSelectionFilters.tournament || 
                                    playerSelectionFilters.date_from || playerSelectionFilters.date_to) && 
                                    ` Export will use both player filters and analytics filters.`
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No players available for selection</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Players will load automatically when the Analytics tab opens
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Analytics Filters - For detailed analysis */}
              <Card className="bg-white/95 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-gray-900 flex items-center">
                      <Filter className="h-5 w-5 mr-2" />
                      Additional Filters (for detailed analysis)
                    </CardTitle>
                    <div className="flex space-x-2">
                      <Button onClick={applyAnalyticsFilters} size="sm">
                        Apply Filters
                      </Button>
                      <Button onClick={clearAnalyticsFilters} variant="outline" size="sm">
                        Clear All
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Apply additional filters to refine your analysis. These filters will also apply to the selected players' export data.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Player</label>
                      <select
                        value={selectedFilters.player}
                        onChange={(e) => handleFilterChange('player', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All Players</option>
                        {analyticsFilters.players?.map((player, index) => (
                          <option key={index} value={player}>{player}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                      <select
                        value={selectedFilters.format}
                        onChange={(e) => handleFilterChange('format', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All Formats</option>
                        {analyticsFilters.formats?.map((format, index) => (
                          <option key={index} value={format}>{format}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tournament</label>
                      <select
                        value={selectedFilters.tournament}
                        onChange={(e) => handleFilterChange('tournament', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All Tournaments</option>
                        {analyticsFilters.tournaments?.map((tournament, index) => (
                          <option key={index} value={tournament}>{tournament}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={selectedFilters.date_from}
                        onChange={(e) => handleFilterChange('date_from', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                        min={analyticsFilters.date_range?.min}
                        max={analyticsFilters.date_range?.max}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={selectedFilters.date_to}
                        onChange={(e) => handleFilterChange('date_to', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                        min={analyticsFilters.date_range?.min}
                        max={analyticsFilters.date_range?.max}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Analytics Summary */}
              {analyticsData.summary && Object.keys(analyticsData.summary).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard
                    title="Matches Analyzed"
                    value={analyticsData.summary.total_matches || 0}
                    icon={Calendar}
                    subtitle="In Current Filter"
                  />
                  <StatCard
                    title="Players"
                    value={analyticsData.summary.unique_players || 0}
                    icon={Users}
                    subtitle="Active in Period"
                  />
                  <StatCard
                    title="Formats"
                    value={analyticsData.summary.formats_covered || 0}
                    icon={Target}
                    subtitle="Covered"
                  />
                  <StatCard
                    title="Tournaments"
                    value={analyticsData.summary.tournaments_covered || 0}
                    icon={Award}
                    subtitle="Included"
                  />
                </div>
              )}

              {/* Player Analytics */}
              <Card className="bg-white/95 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Player Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      <p>Loading analytics...</p>
                    </div>
                  ) : analyticsData.players.length > 0 ? (
                    <div className="space-y-6">
                      {analyticsData.players.map((player, index) => (
                        <PlayerAnalyticsCard key={index} player={player} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No analytics data available</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Try adjusting your filters or sync more data
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;