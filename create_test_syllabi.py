import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

output_dir = os.path.abspath("./test_syllabi")
os.makedirs(output_dir, exist_ok=True)

styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Heading1'],
    fontName='Helvetica-Bold',
    fontSize=18,
    leading=22,
    textColor=colors.HexColor('#1E293B'),
    spaceAfter=10
)
heading_style = ParagraphStyle(
    'SectionHeading',
    parent=styles['Heading2'],
    fontName='Helvetica-Bold',
    fontSize=14,
    leading=18,
    textColor=colors.HexColor('#2563EB'),
    spaceBefore=12,
    spaceAfter=6
)
body_style = ParagraphStyle(
    'BodyTextCustom',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=10,
    leading=14,
    textColor=colors.HexColor('#334155'),
    spaceAfter=6
)

syllabi_data = [
    {
        "filename": "Syllabus_1_CS501.pdf",
        "title": "CS 501: Distributed Systems Infrastructure",
        "code": "CS 501",
        "description": "Comprehensive graduate course covering consensus algorithms, fault tolerance, and cloud database architectures.",
        "weeks": [
            ("Week 1", "Raft Consensus Algorithm Paper", "Reading", "ARTICLE", "Read Ongaro & Ousterhout paper on Raft protocol.", "50 Points", "20% of Final Grade", "2026-08-15"),
            ("Week 2", "Distributed Key-Value Store Assignment", "Assignment", "PAPER", "Implement a distributed key-value store with leader election.", "100 Points Possible", "30% of Final Grade", "2026-08-22"),
            ("Week 3", "Watch MIT 6.824 Raft Lecture Video", "Reading", "VIDEO", "Lecture video on consensus mechanics: https://youtube.com/watch?v=raft-consensus", None, None, "2026-08-29")
        ]
    },
    {
        "filename": "Syllabus_2_BIO412.pdf",
        "title": "BIO 412: Advanced Human Genomics & CRISPR",
        "code": "BIO 412",
        "description": "Explores genome editing, CRISPR-Cas9 pathways, and clinical variant classification.",
        "weeks": [
            ("Week 1", "CRISPR Mechanisms Textbook Chapter 3", "Reading", "TEXTBOOK", "Doudna & Charpentier foundational chapters.", "25 Points", "10% of Final Grade", "2026-09-01"),
            ("Week 2", "Genomic Variant Lab Report", "Assignment", "PAPER", "Classify clinical pathogenicity of 5 novel variants.", "150 Points Possible", "35% of Final Grade", "2026-09-10"),
            ("Week 3", "Listen to DNA Today Podcast Episode 140", "Reading", "PODCAST", "Discussion on therapeutic gene editing: https://dnatoday.org/ep140", None, None, "2026-09-18")
        ]
    },
    {
        "filename": "Syllabus_3_LAW702.pdf",
        "title": "LAW 702: Constitutional Jurisprudence",
        "code": "LAW 702",
        "description": "In-depth study of Supreme Court precedents, judicial review, and separation of powers.",
        "weeks": [
            ("Week 1", "Marbury v Madison Supreme Court Opinion", "Reading", "ARTICLE", "Chief Justice Marshall foundational opinion text.", "30 Points", "15% of Final Grade", "2026-09-05"),
            ("Week 2", "Supreme Court Appellate Brief", "Assignment", "PAPER", "Draft a 15-page appellate brief on equal protection doctrine.", "200 Points Possible", "40% of Final Grade", "2026-09-25"),
            ("Week 3", "In Class Oral Argument Simulation", "Assignment", "PRESENTATION", "Present oral arguments before mock judicial panel.", "100 Points Possible", "25% of Final Grade", "2026-10-02")
        ]
    },
    {
        "filename": "Syllabus_4_CPC514.pdf",
        "title": "CPC 514: Research Methods in Counseling",
        "code": "CPC 514",
        "description": "Foundational statistics and qualitative research design for professional counseling practitioners.",
        "weeks": [
            ("Week 1", "Creswell & Creswell Textbook Chapter 1", "Reading", "TEXTBOOK", "Introduction to qualitative and quantitative research designs.", "20 Points", "5% of Final Grade", "2026-09-08"),
            ("Week 2", "Quantitative Survey Design Assignment", "Assignment", "PAPER", "Formulate research hypotheses and design survey scales.", "100 Points Possible", "30% of Final Grade", "2026-09-20"),
            ("Week 3", "Ethics in Human Subjects Research Paper", "Assignment", "PAPER", "IRB protocol review and ethical compliance paper.", "80 Points Possible", "20% of Final Grade", "2026-10-05")
        ]
    },
    {
        "filename": "Syllabus_5_CPC523.pdf",
        "title": "CPC 523: Human Sexuality in Counseling",
        "code": "CPC 523",
        "description": "Clinical approaches to addressing human sexuality across the lifespan in therapeutic settings.",
        "weeks": [
            ("Week 1", "Sexuality in Professional Counseling Chapter", "Reading", "TEXTBOOK", "Frameworks for sex-positive counseling techniques.", "15 Points", "5% of Final Grade", "2026-09-12"),
            ("Week 2", "Watch Emily Nagoski TED Talk Video", "Reading", "VIDEO", "Sexuality and well-being lecture: https://ted.com/talks/nagoski", None, None, "2026-09-19"),
            ("Week 3", "Group Sexuality Research Paper", "Assignment", "PAPER", "Collaborative research paper on clinical intervention models.", "150 Points Possible", "40% of Final Grade", "2026-10-10")
        ]
    },
    {
        "filename": "Syllabus_6_ECON305.pdf",
        "title": "ECON 305: Behavioral Macroeconomics",
        "code": "ECON 305",
        "description": "Study of psychological heuristics, prospect theory, and aggregate market fluctuations.",
        "weeks": [
            ("Week 1", "Thinking Fast and Slow Reading", "Reading", "TEXTBOOK", "Kahneman chapters on cognitive biases.", "20 Points", "10% of Final Grade", "2026-09-14"),
            ("Week 2", "Inflation Dynamics Problem Set", "Assignment", "OTHER", "Mathematical modeling of consumer inflation expectations.", "100 Points Possible", "25% of Final Grade", "2026-09-28"),
            ("Week 3", "Midterm Macroeconomic Policy Exam", "Assignment", "IN_CLASS", "Proctored in-class exam on monetary policy heuristics.", "200 Points Possible", "35% of Final Grade", "2026-10-12")
        ]
    },
    {
        "filename": "Syllabus_7_PHYS601.pdf",
        "title": "PHYS 601: Quantum Field Theory",
        "code": "PHYS 601",
        "description": "Relativistic quantum mechanics, QED, Feynman diagrams, and path integral formulation.",
        "weeks": [
            ("Week 1", "Peskin & Schroeder QFT Chapter 2", "Reading", "TEXTBOOK", "Quantization of scalar fields and Klein-Gordon equation.", "40 Points", "15% of Final Grade", "2026-09-15"),
            ("Week 2", "Feynman Diagrams Problem Set", "Assignment", "PAPER", "Calculate tree-level electron-positron scattering amplitudes.", "120 Points Possible", "30% of Final Grade", "2026-10-01"),
            ("Week 3", "Listen to Quanta Magazine Physics Podcast", "Reading", "PODCAST", "Audio discussion on Higgs field symmetry breaking: https://quantamagazine.org/podcast/qft", None, None, "2026-10-15")
        ]
    },
    {
        "filename": "Syllabus_8_HIST210.pdf",
        "title": "HIST 210: Modern World History",
        "code": "HIST 210",
        "description": "Global political, industrial, and social transformations from 1900 to the present day.",
        "weeks": [
            ("Week 1", "Primary Source Documents Archive Reading", "Reading", "ARTICLE", "Letters and diplomatic cables from World War I archives.", "25 Points", "10% of Final Grade", "2026-09-16"),
            ("Week 2", "Historiography Comparative Analysis Essay", "Assignment", "PAPER", "Compare orthodox and revisionist historical interpretations.", "100 Points Possible", "30% of Final Grade", "2026-10-04"),
            ("Week 3", "Decolonization Presentation Slide Deck", "Assignment", "PRESENTATION", "Group presentation on post-WWII independence movements.", "80 Points Possible", "20% of Final Grade", "2026-10-18")
        ]
    },
    {
        "filename": "Syllabus_9_ART150.pdf",
        "title": "ART 150: Digital Media Architecture",
        "code": "ART 150",
        "description": "Design principles, vector graphic design, user interface typography, and interactive layouts.",
        "weeks": [
            ("Week 1", "UI Typography & Grid Systems", "Reading", "ARTICLE", "Principles of spatial composition in modern UI design.", "20 Points", "10% of Final Grade", "2026-09-18"),
            ("Week 2", "Watch Vector Motion Graphics Tutorial", "Reading", "VIDEO", "Video walk-through of bezier curves: https://adobe.com/tutorials/motion", None, None, "2026-09-25"),
            ("Week 3", "Capstone Interactive Interface Project", "Assignment", "PAPER", "Complete high-fidelity mobile application design prototype.", "150 Points Possible", "40% of Final Grade", "2026-10-20")
        ]
    },
    {
        "filename": "Syllabus_10_PSYCH800.pdf",
        "title": "PSYCH 800: Cognitive Neuroscience",
        "code": "PSYCH 800",
        "description": "Neural mechanisms of memory, executive control, attention networks, and functional neuroimaging.",
        "weeks": [
            ("Week 1", "Principles of Neural Science Chapter 15", "Reading", "TEXTBOOK", "Kandel et al. chapters on hippocampal synaptic plasticity.", "30 Points", "10% of Final Grade", "2026-09-20"),
            ("Week 2", "Functional MRI Data Analysis Lab", "Assignment", "PAPER", "Process BOLD signal timecourses and map motor cortex activation.", "100 Points Possible", "30% of Final Grade", "2026-10-08"),
            ("Week 3", "Cognitive Control Term Paper", "Assignment", "PAPER", "Literature synthesis paper on prefrontal cortex executive function.", "150 Points Possible", "35% of Final Grade", "2026-10-22")
        ]
    }
]

created_files = []
for s in syllabi_data:
    filepath = os.path.join(output_dir, s['filename'])
    doc = SimpleDocTemplate(filepath, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    story.append(Paragraph(s['title'], title_style))
    story.append(Paragraph(f"<b>Course Code:</b> {s['code']} | <b>Term Duration:</b> 16 Weeks", body_style))
    story.append(Paragraph(s['description'], body_style))
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("Course Schedule & Syllabus Requirements", heading_style))
    
    table_data = [
        ["Week", "Title", "Category", "Sub-Type", "Points", "Weight", "Due Date"]
    ]
    for w, t, cat, sub, desc, pts, wt, due in s['weeks']:
        table_data.append([
            w,
            Paragraph(t, body_style),
            cat,
            sub,
            pts or "N/A",
            wt or "N/A",
            due
        ])
        
    t = Table(table_data, colWidths=[45, 180, 60, 75, 60, 60, 60])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#0F172A')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t)
    story.append(Spacer(1, 14))
    
    story.append(Paragraph("Detailed Assignments & Rubrics", heading_style))
    for w, t, cat, sub, desc, pts, wt, due in s['weeks']:
        if cat == "Assignment":
            story.append(Paragraph(f"<b>{t} ({s['code']})</b>", body_style))
            story.append(Paragraph(f"• Description: {desc}", body_style))
            story.append(Paragraph(f"• Points Possible: {pts or 'N/A'} | Grade Weight: {wt or 'N/A'} | Due Date: {due}", body_style))
            story.append(Spacer(1, 6))
            
    doc.build(story)
    created_files.append(filepath)
    print(f"Generated test PDF: {filepath}")

print(f"Successfully generated {len(created_files)} syllabus PDF test files in {output_dir}.")
