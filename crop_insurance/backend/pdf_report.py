import io
import os
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Translation Dictionary
I18N = {
    "en": {
        "title": "AgriShield Enterprise Platform",
        "subtitle": "AI-Powered Crop Damage Analysis & Settlement Report",
        "sec1": "1. Farmer & Policy Details",
        "sec2": "2. Disaster Intimation",
        "sec3": "3. AI-Powered Verification (Multi-Spectral NDVI)",
        "sec4": "4. Final Claim Computation",
        "claim_id": "Claim ID",
        "farmer_name": "Farmer Name",
        "phone": "Phone Number",
        "village": "Village/Block",
        "insured_area": "Insured Area",
        "policy_status": "Policy Status",
        "active": "Active",
        "crop": "Crop Assured",
        "policy": "Policy Number",
        "start_date": "Event Start Date",
        "end_date": "Event End Date",
        "damage_pct": "Estimated Damage Percentage",
        "ml_pred": "Machine Learning Prediction",
        "ai_conf": "AI Confidence Score",
        "fraud_risk": "Fraud Risk Assessment",
        "admin_notes": "Administrator Decision Rationale",
        "no_notes": "No notes provided",
        "req_sum": "Requested Sum Insured",
        "eligible": "Computed Eligible Payout",
        "settlement": "Final Settlement Status",
        "qr_text": "[SCAN QR CODE TO VERIFY THIS REPORT ON AGRISHIELD PLATFORM]",
        "footer": "Secure Hash: {} | Generated automatically by AgriShield AI Engine.",
        "states": {
            "Pending": "Pending",
            "Verified": "Verified",
            "Approved": "Approved",
            "Rejected": "Rejected"
        },
        "farmer_card": {
            "title": "Farmer Registration Certificate",
            "farmer_id": "Farmer ID",
            "name": "Full Name",
            "phone": "Mobile Number",
            "address": "Address",
            "state": "State",
            "district": "District",
            "village": "Village",
            "reg_date": "Registration Date",
            "footer": "This is a system-generated registration certificate for AgriShield AI."
        }
    },
    "ta": {
        "title": "அக்ரிஷீல்ட் நிறுவன தளம்",
        "subtitle": "AI-ஆல் இயக்கப்படும் பயிர் சேத பகுப்பாய்வு மற்றும் தீர்வு அறிக்கை",
        "sec1": "1. விவசாயி மற்றும் கொள்கை விவரங்கள்",
        "sec2": "2. பேரிடர் அறிவிப்பு",
        "sec3": "3. AI-ஆல் சரிபார்ப்பு (மல்டி-ஸ்பெக்ட்ரல் NDVI)",
        "sec4": "4. இறுதி உரிமை கோரல் கணக்கீடு",
        "claim_id": "கோரிக்கை ஐடி",
        "farmer_name": "விவசாயி பெயர்",
        "phone": "தொலைபேசி எண்",
        "village": "கிராமம்/வட்டம்",
        "insured_area": "காப்பீடு செய்யப்பட்ட பகுதி",
        "policy_status": "கொள்கை நிலை",
        "active": "செயலில் உள்ளது",
        "crop": "உறுதி செய்யப்பட்ட பயிர்",
        "policy": "கொள்கை எண்",
        "start_date": "நிகழ்வு தொடக்க தேதி",
        "end_date": "நிகழ்வு முடிவு தேதி",
        "damage_pct": "மதிப்பிடப்பட்ட சேத சதவீதம்",
        "ml_pred": "இயந்திர கற்றல் கணிப்பு",
        "ai_conf": "AI நம்பிக்கை மதிப்பெண்",
        "fraud_risk": "மோசடி அபாய மதிப்பீடு",
        "admin_notes": "நிர்வாக முடிவின் அடிப்படை",
        "no_notes": "குறிப்புகள் வழங்கப்படவில்லை",
        "req_sum": "கோரப்பட்ட காப்பீட்டுத் தொகை",
        "eligible": "கணக்கிடப்பட்ட தகுதியான தொகை",
        "settlement": "இறுதி தீர்வு நிலை",
        "qr_text": "[இந்த அறிக்கையை அக்ரிஷீல்ட் தளத்தில் சரிபார்க்க QR குறியீட்டை ஸ்கேன் செய்யவும்]",
        "footer": "பாதுகாப்பான ஹாஷ்: {} | அக்ரிஷீல்ட் AI இன்ஜின் மூலம் தானாக உருவாக்கப்பட்டது.",
        "states": {
            "Pending": "நிலுவையில் உள்ளது",
            "Verified": "சரிபார்க்கப்பட்டது",
            "Approved": "அங்கீகரிக்கப்பட்டது",
            "Rejected": "நிராகரிக்கப்பட்டது"
        },
        "farmer_card": {
            "title": "விவசாயி பதிவு சான்றிதழ்",
            "farmer_id": "விவசாயி ஐடி",
            "name": "முழு பெயர்",
            "phone": "கைபேசி எண்",
            "address": "முகவரி",
            "state": "மாநிலம்",
            "district": "மாவட்டம்",
            "village": "கிராமம்",
            "reg_date": "பதிவு தேதி",
            "footer": "இது அக்ரிஷீல்ட் AI க்கான கணினி மூலம் உருவாக்கப்பட்ட பதிவு சான்றிதழ் ஆகும்."
        }
    }
}

# Register Tamil-compatible font if exists
FONT_PATH = "C:/Windows/Fonts/Nirmala.ttc"
HAS_TAMIL_FONT = os.path.exists(FONT_PATH)
if HAS_TAMIL_FONT:
    try:
        pdfmetrics.registerFont(TTFont('Nirmala', FONT_PATH))
    except:
        HAS_TAMIL_FONT = False

def generate_farmer_card_pdf(farmer, lang="en") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=50, bottomMargin=50)
    Story = []
    styles = getSampleStyleSheet()
    
    # Select language
    tx = I18N.get(lang, I18N["en"])["farmer_card"]
    font_name = "Nirmala" if lang == "ta" and HAS_TAMIL_FONT else "Helvetica"
    font_bold = "Nirmala" if lang == "ta" and HAS_TAMIL_FONT else "Helvetica-Bold"
    
    title_style = ParagraphStyle(name="TitleStyle", parent=styles["Heading1"], alignment=TA_CENTER, fontSize=22, leading=26, spaceAfter=20, textColor=colors.HexColor("#065f46"), fontName=font_bold)
    label_style = ParagraphStyle(name="LabelStyle", parent=styles["Normal"], fontSize=12, fontName=font_bold, textColor=colors.HexColor("#374151"))
    value_style = ParagraphStyle(name="ValueStyle", parent=styles["Normal"], fontSize=12, fontName=font_name, textColor=colors.black)
    
    # Header
    Story.append(Paragraph(tx['title'], title_style))
    Story.append(Spacer(1, 20))
    
    # Table Styles
    t_style = TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#f3f4f6")),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor("#111827")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), font_name),
        ('FONTNAME', (0, 0), (0, -1), font_bold),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#e5e7eb")),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ])

    data = [
        [tx["farmer_id"], farmer.farmer_id],
        [tx["name"], farmer.full_name],
        [tx["phone"], farmer.mobile_number],
        [tx["address"], farmer.address],
        [tx["state"], farmer.state],
        [tx["district"], farmer.district],
        [tx["village"], farmer.village],
        [tx["reg_date"], str(farmer.registration_date)],
    ]
    
    t = Table(data, colWidths=[150, 350])
    t.setStyle(t_style)
    Story.append(t)
    Story.append(Spacer(1, 40))
    
    # Signoff
    signoff_style = ParagraphStyle(name="Signoff", alignment=TA_CENTER, fontSize=10, textColor=colors.gray, fontName=font_name)
    Story.append(Paragraph(tx["footer"], signoff_style))
    
    doc.build(Story)
    buffer.seek(0)
    return buffer.read()

def generate_claim_pdf(claim, lang="en") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=50, bottomMargin=50)
    Story = []
    styles = getSampleStyleSheet()
    
    # Select language
    tx = I18N.get(lang, I18N["en"])
    font_name = "Nirmala" if lang == "ta" and HAS_TAMIL_FONT else "Helvetica"
    font_bold = "Nirmala" if lang == "ta" and HAS_TAMIL_FONT else "Helvetica-Bold"
    
    title_style = ParagraphStyle(name="TitleStyle", parent=styles["Heading1"], alignment=TA_CENTER, fontSize=18, leading=22, spaceAfter=5, textColor=colors.HexColor("#065f46"), fontName=font_bold)
    subtitle_style = ParagraphStyle(name="SubtitleStyle", parent=styles["Heading2"], alignment=TA_CENTER, fontSize=12, leading=14, textColor=colors.HexColor("#4a4a4a"), spaceAfter=20, fontName=font_name)
    section_style = ParagraphStyle(name="SectionStyle", parent=styles["Heading3"], fontName=font_bold)
    normal_style = styles["Normal"]
    normal_style.fontName = font_name
    
    # Header
    Story.append(Paragraph(f"<b>{tx['title']}</b>", title_style))
    Story.append(Paragraph(tx['subtitle'], subtitle_style))
    Story.append(Spacer(1, 10))
    
    # Table Styles
    t_style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#ecfdf5")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#064e3b")),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), font_name),
        ('FONTNAME', (0, 0), (-1, 0), font_bold),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#d1d5db")),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ])

    # 1. Farmer Details Table
    Story.append(Paragraph(f"<b>{tx['sec1']}</b>", section_style))
    
    area_hectares = getattr(claim, 'area_hectares', 0) or 0
    area_acres = getattr(claim, 'area_acres', 0) or 0
    area_text = f"{area_hectares:.2f} Ha ({area_acres:.2f} Acres)" if area_hectares > 0 else "N/A"
    
    farmer_data = [
        [tx["claim_id"], claim.claim_id, tx["farmer_name"], claim.farmer_name],
        [tx["phone"], claim.phone_number, tx["village"], claim.village],
        [tx["insured_area"], area_text, tx["policy_status"], tx["active"]]
    ]
    t_farmer = Table(farmer_data, colWidths=[110, 145, 110, 145])
    t_farmer.setStyle(t_style)
    Story.append(t_farmer)
    Story.append(Spacer(1, 15))
    
    # 2. Cause of Loss Intimation Table
    Story.append(Paragraph(f"<b>{tx['sec2']}</b>", section_style))
    event_data = [
        [tx["crop"], claim.crop_type],
        [tx["policy"], claim.policy_number],
        [tx["start_date"], str(claim.event_start_date)],
        [tx["end_date"], str(claim.event_end_date)],
    ]
    t_event = Table(event_data, colWidths=[200, 310])
    t_event.setStyle(t_style)
    Story.append(t_event)
    Story.append(Spacer(1, 15))
    
    # 3. AI Verification Inputs
    Story.append(Paragraph(f"<b>{tx['sec3']}</b>", section_style))
    dmg_pct = f"{claim.damage_percentage:.2f}%" if claim.damage_percentage is not None else "N/A"
    conf_pct = f"{(claim.ml_confidence * 100):.1f}%" if getattr(claim, 'ml_confidence', None) else "N/A"
    
    verif_data = [
        [tx["damage_pct"], dmg_pct],
        [tx["ml_pred"], claim.ml_prediction if claim.ml_prediction else "N/A"],
        [tx["ai_conf"], conf_pct],
        [tx["fraud_risk"], getattr(claim, 'fraud_risk_level', 'N/A')],
        [tx["admin_notes"], claim.admin_notes if claim.admin_notes else tx["no_notes"]]
    ]
    t_verif = Table(verif_data, colWidths=[200, 310])
    t_verif.setStyle(t_style)
    Story.append(t_verif)
    Story.append(Spacer(1, 15))

    # 4. Claim Computation
    Story.append(Paragraph(f"<b>{tx['sec4']}</b>", section_style))
    claim_val = f"Rs. {claim.requested_claim_amount:,.2f}" if getattr(claim, 'requested_claim_amount', None) is not None else "Rs. 0.00"
    sugg_val = f"Rs. {claim.suggested_payout:,.2f}" if getattr(claim, 'suggested_payout', None) is not None else "Rs. 0.00"
    
    comp_data = [
        [tx["req_sum"], claim_val],
        [tx["eligible"], sugg_val],
        [tx["settlement"], tx["states"].get(claim.status, claim.status)]
    ]
    t_comp_style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fff8")),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#cccccc")),
        ('FONTNAME', (0, 0), (-1, -1), font_name),
        ('FONTNAME', (0, -1), (-1, -1), font_bold),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ])
    t_comp = Table(comp_data, colWidths=[200, 310])
    t_comp.setStyle(t_comp_style)
    Story.append(t_comp)
    Story.append(Spacer(1, 40))
    
    # Verification QR & Signoff
    signoff_style = ParagraphStyle(name="Signoff", alignment=TA_CENTER, fontSize=10, textColor=colors.gray, fontName=font_name)
    Story.append(Paragraph(f"<b>{tx['qr_text']}</b>", signoff_style))
    Story.append(Spacer(1, 10))
    Story.append(Paragraph(tx["footer"].format(hash(claim.claim_id)), signoff_style))
    
    doc.build(Story)
    buffer.seek(0)
    return buffer.read()
