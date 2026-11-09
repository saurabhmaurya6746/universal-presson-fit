"""
Seed Official Brand Sizing Charts for Nail World:
1. PRESSE (PRESET_SET)
2. Joyee (NUMBERED_SIZE)
3. Glamnetic (SHAPE_RANGE)

Preserves exact user-provided measurements with verification_status='user_provided'.
Safe and idempotent.
"""
import uuid
from decimal import Decimal
from sqlalchemy.orm import Session
from app.db.session import get_session_factory
from app.models.user import User
from app.models.brand import Brand
from app.models.chart import SizingChart, SizingChartEntry
from app.core.security import hash_password


def get_or_create_admin(db: Session) -> User:
    admin = db.query(User).filter(User.role == "admin").first()
    if not admin:
        admin = User(
            id=uuid.uuid4(),
            email="admin@nailworld.com",
            password_hash=hash_password("AdminSecurePassword123!"),
            full_name="Platform Administrator",
            role="admin",
            is_active=True,
            email_verified=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
    return admin


def seed_presse(db: Session, admin_id: uuid.UUID):
    brand = db.query(Brand).filter(Brand.slug == "presse").first()
    if not brand:
        brand = Brand(
            id=uuid.uuid4(),
            owner_id=admin_id,
            name="PRESSE",
            slug="presse",
            tagline="Salon-Quality Press-On Nails Designed for Everyday Wear",
            description="PRESSE offers reusable salon-grade press-on nails with precise millimeter sizing across standard XS through L sizing kits.",
            logo_url="/logos/presse.png",
            website="https://pressenails.com",
            contact_email="support@pressenails.com",
            country="United States",
            status="active",
            is_public=True,
            is_official=True,
            shapes=["Almond", "Square", "Coffin", "Oval"],
        )
        db.add(brand)
        db.flush()
    else:
        brand.is_official = True
        brand.is_public = True
        brand.status = "active"

    chart = db.query(SizingChart).filter(SizingChart.brand_id == brand.id).first()
    if not chart:
        chart = SizingChart(
            id=uuid.uuid4(),
            brand_id=brand.id,
            chart_name="PRESSE Standard Sizing Guide",
            format="preset_set",
            unit="mm",
            status="published",
            is_public=True,
            is_official=True,
            custom_notes="The size chart lists measurements in mm for the widest points of each natural fingernail.",
            source_url="https://pressenails.com/sizing-guide",
            source_notes="Extracted from user-provided PRESSE sizing guide screenshot.",
            verification_status="user_provided",
            source_type="preset",
            version=1,
        )
        db.add(chart)
        db.flush()

        presse_entries = [
            {"size": "XS", "thumb": 14.0, "index": 10.0, "middle": 11.0, "ring": 10.0, "pinky": 9.0, "order": 0},
            {"size": "S", "thumb": 15.0, "index": 11.0, "middle": 12.0, "ring": 11.0, "pinky": 9.0, "order": 1},
            {"size": "M", "thumb": 16.0, "index": 12.0, "middle": 13.0, "ring": 12.0, "pinky": 10.0, "order": 2},
            {"size": "L", "thumb": 17.0, "index": 13.0, "middle": 14.0, "ring": 13.0, "pinky": 10.0, "order": 3},
        ]
        for e in presse_entries:
            db.add(
                SizingChartEntry(
                    id=uuid.uuid4(),
                    chart_id=chart.id,
                    size_label=e["size"],
                    thumb_width_mm=Decimal(str(e["thumb"])),
                    index_width_mm=Decimal(str(e["index"])),
                    middle_width_mm=Decimal(str(e["middle"])),
                    ring_width_mm=Decimal(str(e["ring"])),
                    pinky_width_mm=Decimal(str(e["pinky"])),
                    display_order=e["order"],
                )
            )
        db.commit()


def seed_joyee(db: Session, admin_id: uuid.UUID):
    brand = db.query(Brand).filter(Brand.slug == "joyee").first()
    if not brand:
        brand = Brand(
            id=uuid.uuid4(),
            owner_id=admin_id,
            name="Joyee",
            slug="joyee",
            tagline="Handmade Boutique Press-On Nails with Signature Inverted Sizing",
            description="Joyee Nails creates bespoke handmade press-on sets numbered 0 to 9, where 0 is petite pinky and 9 is extra-wide thumb.",
            logo_url="/logos/joyee.png",
            website="https://joyeenails.com",
            contact_email="hello@joyeenails.com",
            country="United States",
            status="active",
            is_public=True,
            is_official=True,
            shapes=["Almond", "Coffin", "Square", "Oval", "Stiletto"],
        )
        db.add(brand)
        db.flush()
    else:
        brand.is_official = True
        brand.is_public = True
        brand.status = "active"

    chart = db.query(SizingChart).filter(SizingChart.brand_id == brand.id).first()
    if not chart:
        chart = SizingChart(
            id=uuid.uuid4(),
            brand_id=brand.id,
            chart_name="Joyee Numbered Size Guide",
            format="numbered_size",
            unit="mm",
            status="published",
            is_public=True,
            is_official=True,
            custom_notes="Important: Size 0 is smallest (~7mm) and Size 9 is largest (~17mm). Size 8 is a range (~15-16mm).",
            source_url="https://joyeenails.com/pages/size-guide",
            source_notes="Extracted from joyeenails.com sizing guide screenshot. Measurements are approximate.",
            verification_status="user_provided",
            source_type="manual",
            version=1,
        )
        db.add(chart)
        db.flush()

        joyee_entries = [
            {"size": "0", "width": 7.0, "min_w": None, "max_w": None, "approx": True, "finger": "Pinky (petite hands)", "order": 0},
            {"size": "1", "width": 8.0, "min_w": None, "max_w": None, "approx": True, "finger": "Pinky (average hands)", "order": 1},
            {"size": "2", "width": 9.0, "min_w": None, "max_w": None, "approx": True, "finger": "Ring (petite)", "order": 2},
            {"size": "3", "width": 10.0, "min_w": None, "max_w": None, "approx": True, "finger": "Ring / Middle", "order": 3},
            {"size": "4", "width": 11.0, "min_w": None, "max_w": None, "approx": True, "finger": "Middle (average)", "order": 4},
            {"size": "5", "width": 12.0, "min_w": None, "max_w": None, "approx": True, "finger": "Index / Thumb (petite)", "order": 5},
            {"size": "6", "width": 13.0, "min_w": None, "max_w": None, "approx": True, "finger": "Thumb (average)", "order": 6},
            {"size": "7", "width": 14.0, "min_w": None, "max_w": None, "approx": True, "finger": "Thumb (wider)", "order": 7},
            {"size": "8", "width": None, "min_w": 15.0, "max_w": 16.0, "approx": True, "finger": "Thumb (wide nail beds)", "order": 8},
            {"size": "9", "width": 17.0, "min_w": None, "max_w": None, "approx": True, "finger": "Thumb (extra wide)", "order": 9},
        ]
        for e in joyee_entries:
            db.add(
                SizingChartEntry(
                    id=uuid.uuid4(),
                    chart_id=chart.id,
                    size_label=e["size"],
                    width_mm=Decimal(str(e["width"])) if e["width"] is not None else None,
                    min_width_mm=Decimal(str(e["min_w"])) if e["min_w"] is not None else None,
                    max_width_mm=Decimal(str(e["max_w"])) if e["max_w"] is not None else None,
                    is_approximate=e["approx"],
                    typical_finger=e["finger"],
                    display_order=e["order"],
                )
            )
        db.commit()


def seed_glamnetic(db: Session, admin_id: uuid.UUID):
    brand = db.query(Brand).filter(Brand.slug == "glamnetic").first()
    if not brand:
        brand = Brand(
            id=uuid.uuid4(),
            owner_id=admin_id,
            name="Glamnetic",
            slug="glamnetic",
            tagline="High-Quality Reusable Press-On Nails in Trendsetting Shapes",
            description="Glamnetic provides high-performance salon press-on nails defined by rigorous shape-wise length and width millimeter specifications.",
            logo_url="/logos/glamnetic.png",
            website="https://www.glamnetic.com",
            contact_email="support@glamnetic.com",
            country="United States",
            status="active",
            is_public=True,
            is_official=True,
            shapes=[
                "Extra Short Round", "Extra Short Square", "Extra Short Almond", "Extra Short Oval",
                "Super Short", "Short Oval", "Short Squoval", "Short Round", "Short Almond",
                "Medium Almond", "Medium Square", "Medium Coffin", "Medium Oval", "Long Coffin"
            ],
        )
        db.add(brand)
        db.flush()
    else:
        brand.is_official = True
        brand.is_public = True
        brand.status = "active"

    chart = db.query(SizingChart).filter(SizingChart.brand_id == brand.id).first()
    if not chart:
        chart = SizingChart(
            id=uuid.uuid4(),
            brand_id=brand.id,
            chart_name="Glamnetic Shape-Based Dimension Guide",
            format="shape_range",
            unit="mm",
            status="published",
            is_public=True,
            is_official=True,
            custom_notes="Shape-wise measurement ranges in millimeters with consistent 0.6mm thickness across all 14 shapes.",
            source_url="https://www.glamnetic.com/pages/size-guide",
            source_notes="Extracted from user-provided Glamnetic shape measurement specification chart.",
            verification_status="user_provided",
            source_type="manual",
            version=1,
        )
        db.add(chart)
        db.flush()

        glamnetic_data = [
            ("Extra Short Round", 11.40, 16.65, 6.50, 13.95, 0.6),
            ("Extra Short Square", 11.50, 16.70, 6.50, 13.90, 0.6),
            ("Extra Short Almond", 12.78, 18.05, 6.40, 13.80, 0.6),
            ("Extra Short Oval", 11.42, 16.70, 6.50, 13.80, 0.6),
            ("Super Short", 10.04, 15.22, 6.66, 12.59, 0.6),
            ("Short Oval", 12.51, 19.24, 6.34, 14.11, 0.6),
            ("Short Squoval", 12.45, 18.51, 6.72, 14.17, 0.6),
            ("Short Round", 13.60, 22.00, 6.70, 14.00, 0.6),
            ("Short Almond", 15.33, 22.33, 6.55, 14.08, 0.6),
            ("Medium Almond", 18.69, 24.18, 6.55, 14.08, 0.6),
            ("Medium Square", 15.30, 19.55, 6.51, 13.90, 0.6),
            ("Medium Coffin", 15.58, 21.29, 6.29, 13.98, 0.6),
            ("Medium Oval", 18.71, 23.85, 7.36, 14.62, 0.6),
            ("Long Coffin", 19.81, 25.94, 6.39, 14.08, 0.6),
        ]

        for idx, (shape_name, l_min, l_max, w_min, w_max, thick) in enumerate(glamnetic_data):
            db.add(
                SizingChartEntry(
                    id=uuid.uuid4(),
                    chart_id=chart.id,
                    size_label=shape_name,
                    shape=shape_name,
                    min_length_mm=Decimal(str(l_min)),
                    max_length_mm=Decimal(str(l_max)),
                    min_width_mm=Decimal(str(w_min)),
                    max_width_mm=Decimal(str(w_max)),
                    thickness_mm=Decimal(str(thick)),
                    display_order=idx,
                )
            )
        db.commit()


def seed_the_nailest(db: Session, admin_id: uuid.UUID):
    the_nailest_shapes = [
        "Short Oval",
        "Short Square",
        "Regular Square",
        "Regular Coffin",
        "Regular Stiletto",
        "Regular Oval",
        "Regular Almond",
        "Long Square",
        "Long Coffin",
        "Long Stiletto",
    ]

    brand = db.query(Brand).filter(Brand.slug == "the-nailest").first()
    if not brand:
        brand = Brand(
            id=uuid.uuid4(),
            owner_id=admin_id,
            name="The Nailest",
            slug="the-nailest",
            tagline="Handmade Luxury Press-On Nails Designed with Precision Lengths",
            description="The Nailest offers artisan handmade press-on nails in 10 signature shapes with exact millimeter length specifications across numbered tips #0 through #9.",
            logo_url="/logos/the-nailest.png",
            website="https://thenailest.com",
            contact_email="support@thenailest.com",
            country="United States",
            status="active",
            is_public=True,
            is_official=True,
            shapes=the_nailest_shapes,
        )
        db.add(brand)
        db.flush()
    else:
        brand.is_official = True
        brand.is_public = True
        brand.status = "active"
        brand.shapes = the_nailest_shapes

    chart = db.query(SizingChart).filter(SizingChart.brand_id == brand.id).first()
    if not chart:
        chart = SizingChart(
            id=uuid.uuid4(),
            brand_id=brand.id,
            chart_name="The Nailest Numbered Length Guide",
            format="length_only_numbered",
            unit="mm",
            status="published",
            is_public=True,
            is_official=True,
            custom_notes="Length information is available, but width measurements are not provided by this brand. Numbered sizes from #0 (longest) to #9 (shortest). Length in mm is measured vertically from cuticle base to tip.",
            source_url="https://thenailest.com/pages/sizing-chart",
            source_notes="Extracted from user-provided The Nailest sizing chart screenshots.",
            verification_status="user_provided",
            source_type="manual",
            version=1,
        )
        db.add(chart)
        db.flush()

        # The 10 shapes and exact millimeter lengths for #0 through #9
        nailest_matrix = {
            "Short Oval": [23, 22, 21, 20, 19, 18, 17, 16, 15, 15],
            "Short Square": [21, 20, 19, 19, 18, 18, 17, 16, 15, 14],
            "Regular Square": [24, 23, 22, 21, 20, 19, 18, 17, 16, 15],
            "Regular Coffin": [24, 23, 22, 21, 20, 19, 18, 17, 16, 15],
            "Regular Stiletto": [25, 24, 23, 22, 21, 20, 19, 18, 17, 16],
            "Regular Oval": [26, 25, 24, 23, 22, 21, 20, 19, 18, 17],
            "Regular Almond": [26, 25, 24, 23, 22, 21, 20, 19, 18, 17],
            "Long Square": [30, 29, 28, 27, 26, 25, 24, 23, 22, 21],
            "Long Coffin": [34, 33, 32, 31, 30, 29, 28, 27, 26, 25],
            "Long Stiletto": [37, 36, 35, 34, 33, 32, 31, 30, 29, 28],
        }

        order = 0
        for shape_name, lengths in nailest_matrix.items():
            for num_idx, length_val in enumerate(lengths):
                db.add(
                    SizingChartEntry(
                        id=uuid.uuid4(),
                        chart_id=chart.id,
                        size_label=f"#{num_idx}",
                        shape=shape_name,
                        length_mm=Decimal(str(length_val)),
                        width_mm=None,
                        min_width_mm=None,
                        max_width_mm=None,
                        min_length_mm=None,
                        max_length_mm=None,
                        thickness_mm=None,
                        finger=None,
                        typical_finger=None,
                        is_approximate=False,
                        display_order=order,
                    )
                )
                order += 1
        db.commit()


def run_seeds():
    session_maker = get_session_factory()
    db = session_maker()
    try:
        admin = get_or_create_admin(db)
        seed_presse(db, admin.id)
        seed_joyee(db, admin.id)
        seed_glamnetic(db, admin.id)
        seed_the_nailest(db, admin.id)
        print("Successfully seeded official sizing charts for PRESSE, Joyee, Glamnetic, and The Nailest.")
    finally:
        db.close()


if __name__ == "__main__":
    run_seeds()
