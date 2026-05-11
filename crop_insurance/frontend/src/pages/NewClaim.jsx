import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup, useMap, useMapEvents } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import * as turfArea from '@turf/area';
import * as turfCenter from '@turf/center';
import * as turfLength from '@turf/length';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import { useTranslation } from '../i18n/LanguageContext';

import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-geosearch/dist/geosearch.css';

// Component to add search bar
const SearchField = () => {
    const map = useMap();
    const { t } = useTranslation();
    useEffect(() => {
        const provider = new OpenStreetMapProvider({
            params: {
                countrycodes: 'in'
            }
        });
        const searchControl = new GeoSearchControl({
            provider: provider,
            style: 'bar',
            showMarker: true,
            showPopup: false,
            autoClose: true,
            retainZoomLevel: false,
            animateZoom: true,
            keepResult: false,
            searchLabel: t('new_claim.map.search')
        });
        map.addControl(searchControl);
        return () => map.removeControl(searchControl);
    }, [map, t]);
    return null;
};

// Component to listen to map movements for minimap
const MapEvents = ({ setMapCenter, setMapZoom }) => {
    useMapEvents({
        moveend: (e) => {
            setMapCenter(e.target.getCenter());
            setMapZoom(e.target.getZoom());
        },
    });
    return null;
};

// Component to dynamically sync the Minimap center and zoom from the main map state without layout thrashing
const MinimapSync = ({ mainMapCenter, mainMapZoom }) => {
    const minimap = useMap();
    useEffect(() => {
        if (mainMapCenter) {
            minimap.setView(mainMapCenter, Math.max(1, mainMapZoom - 4), { animate: true });
        }
    }, [mainMapCenter, mainMapZoom, minimap]);
    return null;
};

const NewClaim = () => {
    const navigate = useNavigate();
    const { t, language } = useTranslation();
    const [formData, setFormData] = useState({
        farmer_name: '',
        phone_number: '',
        village: '',
        farmer_id: '',
        policy_number: '',
        crop_type: '',
        sowing_date: '',
        expected_harvest_date: '',
        event_start_date: '',
        event_end_date: '',
        date_of_loss: '',
        requested_claim_amount: ''
    });
    const [dateErrors, setDateErrors] = useState({});
    const [policyData, setPolicyData] = useState(null);
    const [validatingPolicy, setValidatingPolicy] = useState(false);
    const [policyError, setPolicyError] = useState(null);
    
    const [polygonData, setPolygonData] = useState(null);
    const [areaInfo, setAreaInfo] = useState({ acres: 0, hectares: 0, perimeter: 0, center: null });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Boundary Verification State
    const [boundaryValidation, setBoundaryValidation] = useState(null);
    const [validatingBoundary, setValidatingBoundary] = useState(false);

    // Map Sync State
    const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);
    const [mapZoom, setMapZoom] = useState(5);
    const [mapInstance, setMapInstance] = useState(null);
    const featureGroupRef = useRef(null);

    // Boundary analysis API trigger
    const validateBoundary = async (geojson, insuredLandArea) => {
        if (!geojson || !insuredLandArea) {
            setBoundaryValidation(null);
            return;
        }
        setValidatingBoundary(true);
        try {
            // Recalculate area locally using turf to sync with request payload
            const sqMeters = turfArea.area(geojson);
            const hectares = sqMeters / 10000;
            const acres = hectares * 2.47105;
            
            const payload = {
                polygon_geojson: JSON.stringify(geojson),
                insured_land_area: parseFloat(insuredLandArea),
                area_acres: parseFloat(acres.toFixed(4))
            };
            const res = await api.post('/api/claims/analyze-boundary', payload);
            setBoundaryValidation(res.data);
        } catch (err) {
            console.error("Boundary analysis failed:", err);
            setBoundaryValidation({
                land_classification: "Unknown/Barren",
                is_valid_india: false,
                is_valid_land_type: false,
                is_valid_area_tolerance: false,
                area_difference: 0,
                satellite_ref: "",
                timestamp: new Date().toISOString(),
                error: err.response?.data?.detail || "Validation failed"
            });
        } finally {
            setValidatingBoundary(false);
        }
    };

    // Geodesic Square Calculator to generate a square polygon of exactly A acres at any Lat/Lng center
    const generateAcreSquare = (centerLat, centerLng, targetAcres) => {
        const R = 6371000; // Earth radius in meters
        const sqMeters = targetAcres * 4046.85642;
        const halfSide = Math.sqrt(sqMeters) / 2;
        
        const latOffset = (halfSide / R) * (180 / Math.PI);
        const lngOffset = (halfSide / (R * Math.cos(centerLat * Math.PI / 180))) * (180 / Math.PI);
        
        const coordinates = [
            [centerLng - lngOffset, centerLat + latOffset],
            [centerLng + lngOffset, centerLat + latOffset],
            [centerLng + lngOffset, centerLat - latOffset],
            [centerLng - lngOffset, centerLat - latOffset],
            [centerLng - lngOffset, centerLat + latOffset] // close shape
        ];
        
        return {
            type: "Feature",
            properties: {},
            geometry: {
                type: "Polygon",
                coordinates: [coordinates]
            }
        };
    };

    // Helper to make any Leaflet Polygon draggable and vertex-editable dynamically
    const makeLayerMovable = (layer, targetAcres) => {
        if (!window.L || !mapInstance) return;
        
        let isDragging = false;
        let startLatLng = null;

        layer.on('mousedown', (e) => {
            isDragging = true;
            startLatLng = e.latlng;
            mapInstance.dragging.disable();
            // Stop propagation so map panning is not triggered during drag
            if (e.originalEvent) {
                e.originalEvent.stopPropagation();
            }
        });

        const onMouseMove = (e) => {
            if (isDragging && startLatLng) {
                const currentLatLng = e.latlng;
                const deltaLat = currentLatLng.lat - startLatLng.lat;
                const deltaLng = currentLatLng.lng - startLatLng.lng;
                
                const latlngs = layer.getLatLngs();
                const updateCoords = (coords) => {
                    return coords.map(item => {
                        if (Array.isArray(item)) {
                            return updateCoords(item);
                        } else {
                            return window.L.latLng(item.lat + deltaLat, item.lng + deltaLng);
                        }
                    });
                };
                
                const newLatLngs = updateCoords(latlngs);
                layer.setLatLngs(newLatLngs);
                startLatLng = currentLatLng;
                
                const geojson = layer.toGeoJSON();
                setPolygonData(geojson);
                updateAreaInfo(geojson);
            }
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                mapInstance.dragging.enable();
                const geojson = layer.toGeoJSON();
                validateBoundary(geojson, targetAcres);
            }
        };

        mapInstance.on('mousemove', onMouseMove);
        mapInstance.on('mouseup', onMouseUp);
        layer.on('mouseup', onMouseUp);
        
        // Clean up event listeners if the layer is ever removed
        layer.on('remove', () => {
            mapInstance.off('mousemove', onMouseMove);
            mapInstance.off('mouseup', onMouseUp);
        });

        // Enable vertex-based corner handles editing
        if (layer.editing) {
            layer.editing.enable();
            layer.on('edit', () => {
                const geojson = layer.toGeoJSON();
                setPolygonData(geojson);
                updateAreaInfo(geojson);
                validateBoundary(geojson, targetAcres);
            });
        }
    };

    const handleAutoGenerate = (e) => {
        e.preventDefault();
        if (!policyData || !policyData.land_area || !mapInstance) return;
        
        const center = mapInstance.getCenter();
        const targetAcres = parseFloat(policyData.land_area);
        const squareGeoJSON = generateAcreSquare(center.lat, center.lng, targetAcres);
        
        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers();
            
            const leafletCoords = squareGeoJSON.geometry.coordinates[0].map(pt => [pt[1], pt[0]]);
            
            // Check if L is loaded (Leaflet window variable)
            if (window.L) {
                const layer = window.L.polygon(leafletCoords, {
                    color: '#0ea5e9',
                    weight: 3,
                    fillOpacity: 0.4
                });
                
                featureGroupRef.current.addLayer(layer);
                setPolygonData(squareGeoJSON);
                updateAreaInfo(squareGeoJSON);
                validateBoundary(squareGeoJSON, targetAcres);
                
                // Initialize premium dragging and editing
                makeLayerMovable(layer, targetAcres);
                
                mapInstance.fitBounds(layer.getBounds(), { padding: [50, 50] });
            }
        }
    };

    // Auto-fill and Validate Policy
    useEffect(() => {
        const validate = async () => {
            if (formData.farmer_id.length >= 8 && formData.policy_number.length >= 5) {
                setValidatingPolicy(true);
                setPolicyError(null);
                try {
                    const res = await api.get(`/api/policies/validate?farmer_id=${formData.farmer_id}&policy_number=${formData.policy_number}`);
                    setPolicyData(res.data);
                    setFormData(prev => ({
                        ...prev,
                        farmer_name: res.data.farmer_name,
                        village: res.data.village || prev.village,
                        phone_number: res.data.phone_number || prev.phone_number,
                        crop_type: res.data.crop_type
                    }));
                } catch (err) {
                    setPolicyData(null);
                    setPolicyError(err.response?.data?.detail || t('new_claim.errors.invalid_policy'));
                } finally {
                    setValidatingPolicy(false);
                }
            } else {
                setPolicyData(null);
                setPolicyError(null);
            }
        };
        validate();
    }, [formData.farmer_id, formData.policy_number, t]);

    // Reactive hook to automatically trigger boundary validation when policy is changed/loaded
    useEffect(() => {
        if (polygonData && policyData && policyData.land_area) {
            validateBoundary(polygonData, policyData.land_area);
        }
    }, [policyData]);

    // Update Leaflet Draw UX strings whenever language changes
    useEffect(() => {
        if (typeof window !== 'undefined' && window.L && window.L.drawLocal) {
            window.L.drawLocal.draw.handlers.polygon.tooltip.start = t('new_claim.map.tooltip_start');
            window.L.drawLocal.draw.handlers.polygon.tooltip.cont = t('new_claim.map.tooltip_cont');
            window.L.drawLocal.draw.handlers.polygon.tooltip.end = t('new_claim.map.tooltip_end');
            window.L.drawLocal.draw.handlers.polygon.error = `<strong>${t('new_claim.map.error_cross')}</strong>`;
        }
    }, [t, language]);

    const isAmountValid = () => {
        const amount = parseFloat(formData.requested_claim_amount);
        if (!amount || amount <= 0) return false;
        if (policyData && amount > policyData.insured_amount) return false;
        return true;
    };

    const isDateValid = () => {
        if (!formData.date_of_loss) return false;
        const lossDate = new Date(formData.date_of_loss);
        const today = new Date();
        if (lossDate > today) return false;
        if (policyData) {
            const start = new Date(policyData.start_date);
            const end = new Date(policyData.end_date);
            if (lossDate < start || lossDate > end) return false;
        }
        return true;
    };

    // Comprehensive date validation
    useEffect(() => {
        const errs = {};
        const today = new Date(); today.setHours(23,59,59);
        const sow = formData.sowing_date ? new Date(formData.sowing_date) : null;
        const harv = formData.expected_harvest_date ? new Date(formData.expected_harvest_date) : null;
        const loss = formData.date_of_loss ? new Date(formData.date_of_loss) : null;
        const evStart = formData.event_start_date ? new Date(formData.event_start_date) : null;
        const evEnd = formData.event_end_date ? new Date(formData.event_end_date) : null;
        if (sow) {
            if (sow > today) errs.sowing_date = 'Sowing Date cannot be in the future.';
            const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear()-1);
            if (sow < oneYearAgo) errs.sowing_date = 'Sowing Date must be within the last 12 months.';
        }
        if (harv && sow) {
            if (harv <= sow) errs.expected_harvest_date = 'Expected Harvest Date must be after Sowing Date.';
            const diff = (harv - sow) / (1000*60*60*24*30);
            if (diff < 3 || diff > 12) errs.expected_harvest_date = 'Must be 3 to 12 months after Sowing Date.';
        }
        if (loss) {
            if (loss > today) errs.date_of_loss = 'Date of Loss cannot be in the future.';
            if (sow && loss < sow) errs.date_of_loss = 'Date of Loss must be on or after Sowing Date.';
            if (harv && loss > harv) errs.date_of_loss = 'Date of Loss must be on or before Expected Harvest Date.';
        }
        if (evStart) {
            if (sow && evStart < sow) errs.event_start_date = 'Event Start must be on or after Sowing Date.';
            if (loss && evStart > loss) errs.event_start_date = 'Event Start must be on or before Date of Loss.';
        }
        if (evEnd) {
            if (evStart && evEnd < evStart) errs.event_end_date = 'Event End must be on or after Event Start.';
            if (loss && evEnd > loss) errs.event_end_date = 'Event End must be on or before Date of Loss.';
        }
        setDateErrors(errs);
    }, [formData.sowing_date, formData.expected_harvest_date, formData.date_of_loss, formData.event_start_date, formData.event_end_date]);

    const canSubmit = () => {
        const boundaryOk = boundaryValidation && 
                           boundaryValidation.is_valid_india && 
                           boundaryValidation.is_valid_land_type && 
                           boundaryValidation.is_valid_area_tolerance;
        return (
            policyData &&
            isAmountValid() &&
            isDateValid() &&
            formData.sowing_date &&
            formData.expected_harvest_date &&
            formData.event_start_date &&
            formData.event_end_date &&
            Object.keys(dateErrors).length === 0 &&
            polygonData &&
            boundaryOk
        );
    };

    const toggleFullScreen = (e) => {
        e.preventDefault();
        const elem = document.getElementById('map-wrapper');
        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => {
                alert(`Error: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    const handleLocateMe = (e) => {
        e.preventDefault();
        if (mapInstance) {
            mapInstance.locate({ setView: true, maxZoom: 18 });
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const _onCreated = (e) => {
        const layer = e.layer;
        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers();
            featureGroupRef.current.addLayer(layer);
        }
        const geojson = layer.toGeoJSON();
        setPolygonData(geojson);
        updateAreaInfo(geojson);
        if (policyData && policyData.land_area) {
            validateBoundary(geojson, policyData.land_area);
            makeLayerMovable(layer, parseFloat(policyData.land_area));
        }
    };

    const _onEdited = (e) => {
        const layers = e.layers;
        layers.eachLayer(layer => {
            const geojson = layer.toGeoJSON();
            setPolygonData(geojson);
            updateAreaInfo(geojson);
            if (policyData && policyData.land_area) {
                validateBoundary(geojson, policyData.land_area);
            }
        });
    };

    const _onDeleted = (e) => {
        setPolygonData(null);
        setAreaInfo({ acres: 0, hectares: 0, perimeter: 0, center: null });
        setBoundaryValidation(null);
    };

    const updateAreaInfo = (geojson) => {
        try {
            const sqMeters = turfArea.area(geojson);
            const hectares = sqMeters / 10000;
            const acres = hectares * 2.47105;
            const perimeterKm = turfLength.length(geojson);
            const perimeterMeters = perimeterKm * 1000;
            const centerPoint = turfCenter.center(geojson);
            const coords = centerPoint.geometry.coordinates;
            
            setAreaInfo({
                acres: acres.toFixed(2),
                hectares: hectares.toFixed(2),
                perimeter: perimeterMeters.toFixed(2),
                center: { lat: coords[1].toFixed(4), lng: coords[0].toFixed(4) }
            });
        } catch (err) {
            console.error("Error calculating area:", err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!polygonData) {
            setError(t('new_claim.error_polygon'));
            return;
        }
        if (!canSubmit()) return;

        setLoading(true);
        setError(null);
        try {
            const payload = {
                ...formData,
                requested_claim_amount: parseFloat(formData.requested_claim_amount),
                sowing_date: formData.sowing_date || null,
                expected_harvest_date: formData.expected_harvest_date || null,
                polygon_geojson: JSON.stringify(polygonData),
                area_acres: parseFloat(areaInfo.acres),
                area_hectares: parseFloat(areaInfo.hectares),
                land_classification: boundaryValidation?.land_classification,
                boundary_status: "Valid",
                satellite_ref: boundaryValidation?.satellite_ref,
                boundary_timestamp: boundaryValidation?.timestamp
            };
            const response = await api.post('/api/claims', payload);
            navigate('/status', { state: { claimId: response.data.claim_id } });
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || t('new_claim.error_submit'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-8">
            <h1 className="text-4xl font-extrabold mb-8 text-center text-gradient">{t('new_claim.title')}</h1>

            {error && <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-6 font-medium border border-red-200">{error}</div>}

            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="glass p-6 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400 group-hover:bg-emerald-500 transition-colors"></div>
                        <h2 className="text-xl font-bold mb-4 border-b border-emerald-100 pb-2 text-emerald-800">{t('new_claim.personal_details')}</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('new_claim.farmer_id')}</label>
                                <input required type="text" name="farmer_id" value={formData.farmer_id} onChange={handleChange} className="mt-1 block w-full rounded-xl input-glass p-3 font-mono uppercase" placeholder="FARM2026..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('new_claim.policy_number')}</label>
                                <input required type="text" name="policy_number" value={formData.policy_number} onChange={handleChange} className="mt-1 block w-full rounded-xl input-glass p-3 font-mono uppercase" placeholder="INS2026..." />
                            </div>

                            {validatingPolicy && <p className="col-span-2 text-sm text-emerald-600 animate-pulse">{t('new_claim.validating_policy')}</p>}
                            {policyError && <p className="col-span-2 text-sm text-red-600 font-medium">{policyError}</p>}

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">{t('new_claim.farmer_name')}</label>
                                <input readOnly type="text" value={formData.farmer_name} className="mt-1 block w-full rounded-xl bg-gray-100/50 p-3 font-semibold text-gray-600" />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('new_claim.crop_type')}</label>
                                <input readOnly type="text" value={formData.crop_type} className="mt-1 block w-full rounded-xl bg-gray-100/50 p-3 font-semibold text-gray-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('new_claim.insured_amount')}</label>
                                <input readOnly type="text" value={policyData ? `₹ ${policyData.insured_amount.toLocaleString()}` : '---'} className="mt-1 block w-full rounded-xl bg-gray-100/50 p-3 font-bold text-emerald-700" />
                            </div>

                            {policyData && (
                                <div className="col-span-2 bg-gradient-to-br from-emerald-950/5 to-teal-950/5 backdrop-blur-md rounded-2xl border border-emerald-500/20 p-5 mt-2 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-2xl rounded-full"></div>
                                    <h3 className="text-sm font-bold text-emerald-850 flex items-center gap-2 mb-3 uppercase tracking-wider text-emerald-800">
                                        🛡️ Selected Policy Details
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">
                                        <p>Policy Code: <span className="font-bold text-gray-950">{policyData.policy_code || 'N/A'}</span></p>
                                        <p>Policy Type: <span className="font-bold text-gray-950">{policyData.policy_type || 'N/A'}</span></p>
                                        <p>Crop Insured: <span className="font-bold text-emerald-800">{policyData.crop_type || 'N/A'}</span></p>
                                        <p>Insured Area: <span className="font-bold text-emerald-800">{policyData.land_area || '0.0'} Acres</span></p>
                                        <p className="col-span-2 border-t pt-2 border-emerald-500/10 text-xs">
                                            Coverage Amount: <span className="font-bold text-emerald-800">₹ {policyData.insured_amount?.toLocaleString('en-IN')}</span>
                                        </p>
                                        <p className="col-span-2 text-[11px] text-gray-500">
                                            Validity Period: <span className="font-semibold text-gray-700">{policyData.start_date} to {policyData.end_date}</span>
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">{t('new_claim.requested_amount')}</label>
                                <input required type="number" name="requested_claim_amount" value={formData.requested_claim_amount} onChange={handleChange} className={`mt-1 block w-full rounded-xl input-glass p-3 text-lg font-semibold ${!isAmountValid() && formData.requested_claim_amount ? 'border-red-400 text-red-700' : 'text-emerald-900'}`} />
                                {!isAmountValid() && formData.requested_claim_amount && (
                                    <p className="text-xs text-red-600 mt-1">{t('new_claim.errors.amount_exceeds')}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="glass p-6 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-teal-400 group-hover:bg-teal-500 transition-colors"></div>
                        <h2 className="text-xl font-bold mb-4 border-b border-emerald-100 pb-2 text-emerald-800">{t('new_claim.disaster_details')}</h2>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('new_claim.sowing_date')}</label>
                                <input required type="date" name="sowing_date" value={formData.sowing_date} onChange={handleChange} className={`mt-1 block w-full rounded-xl input-glass p-3 text-gray-700 ${dateErrors.sowing_date ? 'border-red-400' : ''}`} />
                                {dateErrors.sowing_date && <p className="text-xs text-red-600 mt-1">{dateErrors.sowing_date}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('new_claim.expected_harvest')}</label>
                                <input required type="date" name="expected_harvest_date" value={formData.expected_harvest_date} onChange={handleChange} className={`mt-1 block w-full rounded-xl input-glass p-3 text-gray-700 ${dateErrors.expected_harvest_date ? 'border-red-400' : ''}`} />
                                {dateErrors.expected_harvest_date && <p className="text-xs text-red-600 mt-1">{dateErrors.expected_harvest_date}</p>}
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700">{t('new_claim.date_of_loss')}</label>
                            <input required type="date" name="date_of_loss" value={formData.date_of_loss} onChange={handleChange} className={`mt-1 block w-full rounded-xl input-glass p-3 ${dateErrors.date_of_loss ? 'border-red-400 text-red-700' : ''}`} />
                            {dateErrors.date_of_loss && <p className="text-xs text-red-600 mt-1">{dateErrors.date_of_loss}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('new_claim.event_start')}</label>
                                <input required type="date" name="event_start_date" value={formData.event_start_date} onChange={handleChange} className={`mt-1 block w-full rounded-xl input-glass p-3 text-gray-700 ${dateErrors.event_start_date ? 'border-red-400' : ''}`} />
                                {dateErrors.event_start_date && <p className="text-xs text-red-600 mt-1">{dateErrors.event_start_date}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('new_claim.event_end')}</label>
                                <input required type="date" name="event_end_date" value={formData.event_end_date} onChange={handleChange} className={`mt-1 block w-full rounded-xl input-glass p-3 text-gray-700 ${dateErrors.event_end_date ? 'border-red-400' : ''}`} />
                                {dateErrors.event_end_date && <p className="text-xs text-red-600 mt-1">{dateErrors.event_end_date}</p>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass p-6 rounded-2xl flex flex-col relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-400 group-hover:bg-green-500 transition-colors"></div>
                    <h2 className="text-xl font-bold mb-4 border-b border-emerald-100 pb-2 text-emerald-800">{t('new_claim.location_title')}</h2>
                    <p className="text-sm text-gray-500 mb-4">{t('new_claim.location_desc')}</p>

                    {policyData && policyData.land_area && (
                        <div className="flex justify-between items-center mb-4 bg-teal-500/10 border border-teal-500/25 p-3 rounded-xl">
                            <span className="text-xs font-semibold text-teal-900">Need help mapping {policyData.land_area} acres exactly?</span>
                            <button
                                onClick={handleAutoGenerate}
                                className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-md transition-all duration-200 transform hover:-translate-y-0.5 flex items-center gap-1.5"
                            >
                                ✨ Auto-Generate perfect {policyData.land_area} Acre Field
                            </button>
                        </div>
                    )}

                    <div className="flex-grow z-0 min-h-[500px] border border-green-200 rounded-xl overflow-hidden shadow-inner relative group/map" id="map-wrapper">
                        
                        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 opacity-0 group-hover/map:opacity-100 transition-opacity duration-300">
                            <button onClick={toggleFullScreen} className="bg-black/70 hover:bg-black text-white p-2 rounded shadow backdrop-blur-md transition-colors" title="Toggle Fullscreen">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                            </button>
                            <button onClick={handleLocateMe} className="bg-blue-600/90 hover:bg-blue-700 text-white p-2 rounded shadow backdrop-blur-md transition-colors" title="Locate Me (GPS)">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            </button>
                        </div>

                        <div className="absolute bottom-4 right-4 w-32 h-32 border-2 border-white/50 rounded-lg overflow-hidden z-[1000] shadow-xl pointer-events-none opacity-80 group-hover/map:opacity-100 transition-opacity">
                            <MapContainer 
                                center={mapCenter} 
                                zoom={Math.max(1, mapZoom - 4)} 
                                zoomControl={false} 
                                dragging={false} 
                                scrollWheelZoom={false} 
                                doubleClickZoom={false} 
                                style={{ height: '100%', width: '100%' }}
                                maxBounds={[[6.4, 68.1], [37.6, 97.4]]}
                                maxBoundsViscosity={1.0}
                            >
                                <TileLayer 
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                                    updateWhenIdle={true}
                                    keepBuffer={8}
                                />
                                <MinimapSync mainMapCenter={mapCenter} mainMapZoom={mapZoom} />
                            </MapContainer>
                        </div>

                        <MapContainer 
                            center={[20.5937, 78.9629]} 
                            zoom={5} 
                            maxZoom={22} 
                            style={{ height: '100%', width: '100%' }}
                            ref={setMapInstance}
                            maxBounds={[[6.4, 68.1], [37.6, 97.4]]}
                            maxBoundsViscosity={1.0}
                        >
                            <SearchField />
                            <MapEvents setMapCenter={setMapCenter} setMapZoom={setMapZoom} />
                            
                            <TileLayer
                                attribution='&copy; Google Maps'
                                url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga"
                                maxZoom={22}
                                updateWhenIdle={true}
                                keepBuffer={8}
                            />
                            <FeatureGroup ref={featureGroupRef}>
                                <EditControl
                                    position="topleft"
                                    onCreated={_onCreated}
                                    onEdited={_onEdited}
                                    onDeleted={_onDeleted}
                                    draw={{
                                        rectangle: false,
                                        circle: false,
                                        circlemarker: false,
                                        marker: false,
                                        polyline: false,
                                        polygon: {
                                            allowIntersection: false,
                                            drawError: {
                                                color: '#e1e100',
                                                message: `<strong>${t('new_claim.map.error_cross')}</strong>`
                                            },
                                            shapeOptions: {
                                                color: '#0ea5e9',
                                                weight: 3,
                                                fillOpacity: 0.4
                                            }
                                        }
                                    }}
                                />
                            </FeatureGroup>
                        </MapContainer>
                    </div>
                    
                    {polygonData && (
                        <div className="mt-4 space-y-4">
                            {/* Standard Area Metrics Card */}
                            <div className="p-5 glass border border-emerald-200 rounded-2xl flex flex-col md:flex-row justify-between items-center shadow-lg gap-4 relative overflow-hidden bg-white/40">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-3xl rounded-full"></div>
                                <div>
                                    <p className="text-sm text-emerald-800 font-bold flex items-center gap-2">
                                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        {t('new_claim.boundary_captured')}
                                    </p>
                                    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 font-mono">
                                        <p>{t('new_claim.lat')}: <span className="font-bold text-gray-800">{areaInfo.center?.lat}</span></p>
                                        <p>{t('new_claim.lng')}: <span className="font-bold text-gray-800">{areaInfo.center?.lng}</span></p>
                                    </div>
                                </div>
                                <div className="text-right flex gap-6">
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{t('new_claim.perimeter')}</p>
                                        <p className="text-xl font-black text-gray-700">{areaInfo.perimeter} <span className="text-sm font-medium text-gray-500">m</span></p>
                                    </div>
                                    <div className="border-l border-gray-200 pl-6">
                                        <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">{t('new_claim.calculated_area')}</p>
                                        <p className="text-2xl font-black text-emerald-700">{areaInfo.acres} <span className="text-base font-medium text-emerald-600/70">{t('new_claim.acres')}</span></p>
                                        <p className="text-sm font-bold text-gray-500">{areaInfo.hectares} <span className="font-medium text-gray-400">{t('new_claim.hectares')}</span></p>
                                    </div>
                                </div>
                            </div>

                            {/* Boundary Validation & Satellite Classification Card */}
                            {validatingBoundary ? (
                                <div className="p-5 glass border border-emerald-200 rounded-2xl flex flex-col items-center justify-center py-8 shadow-md">
                                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                    <p className="text-sm text-emerald-700 font-semibold animate-pulse">Running Multi-Spectral Boundary Analysis...</p>
                                </div>
                            ) : boundaryValidation ? (
                                <div className={`p-5 rounded-2xl border shadow-lg relative overflow-hidden transition-all duration-300 ${
                                    (boundaryValidation.is_valid_india && boundaryValidation.is_valid_land_type && boundaryValidation.is_valid_area_tolerance)
                                    ? 'bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border-emerald-200' 
                                    : 'bg-gradient-to-r from-red-50/80 to-rose-50/80 border-red-200'
                                }`}>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full"></div>
                                    
                                    <div className="flex justify-between items-center border-b pb-3 mb-4">
                                        <h4 className="font-bold text-sm text-gray-800 flex items-center gap-1.5 uppercase tracking-wide">
                                            🛰️ GIS Real-Time Validation
                                        </h4>
                                        <span className={`text-xs px-3 py-1.5 rounded-full font-black uppercase tracking-wider shadow-sm ${
                                            (boundaryValidation.is_valid_india && boundaryValidation.is_valid_land_type && boundaryValidation.is_valid_area_tolerance)
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-red-500 text-white'
                                        }`}>
                                            {(boundaryValidation.is_valid_india && boundaryValidation.is_valid_land_type && boundaryValidation.is_valid_area_tolerance)
                                            ? 'Valid Farm Boundary'
                                            : 'Invalid Farm Boundary'}
                                        </span>
                                    </div>

                                    <div className="space-y-3 text-xs">
                                        {/* India Restriction */}
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-gray-600">Location Check (Within India)</span>
                                            {boundaryValidation.is_valid_india ? (
                                                <span className="text-emerald-700 font-bold flex items-center gap-1">🟢 Within India</span>
                                            ) : (
                                                <span className="text-red-600 font-black flex items-center gap-1">❌ Outside India Bounds</span>
                                            )}
                                        </div>

                                        {/* Land Classification */}
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-gray-600">Land Classification</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold px-2 py-0.5 rounded bg-white/80 border text-gray-700">{boundaryValidation.land_classification}</span>
                                                {boundaryValidation.is_valid_land_type ? (
                                                    <span className="text-emerald-700 font-bold">🟢 Agricultural</span>
                                                ) : (
                                                    <span className="text-red-600 font-black">❌ Non-Agricultural Land</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Acreage Tolerance */}
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-gray-600">Acreage Matching</span>
                                            <div className="text-right">
                                                {boundaryValidation.is_valid_area_tolerance ? (
                                                    <span className="text-emerald-700 font-bold">🟢 Matches Policy (±5% tolerance)</span>
                                                ) : (
                                                    <span className="text-red-600 font-black">❌ Area Mismatch ({areaInfo.acres} vs {policyData?.land_area} Ac)</span>
                                                )}
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    Difference: {boundaryValidation.area_difference > 0 ? `+${boundaryValidation.area_difference.toFixed(2)}` : boundaryValidation.area_difference.toFixed(2)} Acres
                                                </p>
                                            </div>
                                        </div>

                                        {/* Specific detailed error messaging */}
                                        {(!boundaryValidation.is_valid_india || !boundaryValidation.is_valid_land_type || !boundaryValidation.is_valid_area_tolerance) && (
                                            <div className="mt-4 p-3 bg-white/90 rounded-xl border border-red-200 text-red-700 font-semibold space-y-1">
                                                {!boundaryValidation.is_valid_india && <p>• This farm boundary must be located within India.</p>}
                                                {!boundaryValidation.is_valid_land_type && <p>• The selected area is not recognized as agricultural land. Please draw the actual farm field.</p>}
                                                {!boundaryValidation.is_valid_area_tolerance && <p>• The selected farm boundary area must match the insured land area of {policyData?.land_area} acres (allowed tolerance ±5%).</p>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}
                    {!polygonData && (
                        <p className="text-sm text-green-600 mt-2 font-semibold">
                            {t('new_claim.waiting_polygon')}
                        </p>
                    )}
                </div>

                <div className="md:col-span-2 text-right mt-6">
                    <button
                        type="submit"
                        disabled={loading || !canSubmit()}
                        className="btn-primary px-10 py-4 rounded-xl text-lg w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? t('new_claim.submitting') : t('new_claim.submit')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default NewClaim;
