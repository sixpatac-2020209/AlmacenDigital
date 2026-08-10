import argparse
import csv
import os
import sys
from pathlib import Path
from typing import List, Optional

try:
    import firebase_admin
    from firebase_admin import credentials, firestore, initialize_app
    from google.cloud import storage as gcs_storage
except ImportError as exc:
    print("Falta la dependencia firebase-admin. Instálala con: pip install -r scripts/requirements.txt")
    raise SystemExit(1) from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Importa productos desde CSV y sube sus imágenes a Firebase Storage")
    parser.add_argument("--csv", required=True, help="Ruta al archivo CSV")
    parser.add_argument("--images-root", required=True, help="Carpeta raíz donde están las carpetas de imágenes")
    parser.add_argument("--project-id", default=os.getenv("FIREBASE_PROJECT_ID"), help="ID del proyecto Firebase")
    parser.add_argument("--service-account", default=os.getenv("GOOGLE_APPLICATION_CREDENTIALS"), help="Ruta al JSON de service account")
    parser.add_argument("--collection", default="productos", help="Colección Firestore donde guardar productos")
    parser.add_argument("--dry-run", action="store_true", help="Solo muestra qué haría sin subir nada")
    return parser.parse_args()


def initialize_firebase(project_id: Optional[str], service_account_path: Optional[str]):
    if not project_id:
        raise ValueError("Debes pasar --project-id o definir FIREBASE_PROJECT_ID")

    if service_account_path and os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred, {"projectId": project_id, "storageBucket": f"{project_id}.appspot.com"})
        return

    if os.getenv("GOOGLE_APPLICATION_CREDENTIALS") and os.path.exists(os.getenv("GOOGLE_APPLICATION_CREDENTIALS")):
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": project_id, "storageBucket": f"{project_id}.appspot.com"})
        return

    raise FileNotFoundError(
        "No se encontró un service account. Proporciona --service-account o define GOOGLE_APPLICATION_CREDENTIALS"
    )


def resolve_value(row: dict, *keys: str) -> str:
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return str(row[key]).strip()
    return ""


def find_image_files(folder: Path) -> List[Path]:
    if not folder.exists():
        return []

    allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    files = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in allowed_exts]
    return sorted(files)


def find_product_folder(images_root: Path, row: dict) -> Optional[Path]:
    code = resolve_value(row, "codigo", "code", "sku", "id", "product_code")
    if not code:
        return None

    candidate_dirs = [
        images_root / code,
        images_root / str(code).strip(),
        images_root / str(code).replace(" ", "_"),
        images_root / str(code).lower(),
    ]

    for candidate in candidate_dirs:
        if candidate.exists() and candidate.is_dir():
            return candidate

    # fallback: buscar carpeta que contenga el código en el nombre
    for child in images_root.iterdir():
        if child.is_dir() and code.lower() in child.name.lower():
            return child

    return None


def upload_image_to_storage(bucket, local_path: Path, destination_path: str) -> str:
    blob = bucket.blob(destination_path)
    blob.upload_from_filename(str(local_path))
    blob.make_public()
    return blob.public_url


def import_csv(csv_path: str, images_root: str, project_id: str, service_account: Optional[str], collection: str, dry_run: bool):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"No existe el CSV: {csv_path}")

    images_root_path = Path(images_root)
    if not images_root_path.exists():
        raise FileNotFoundError(f"No existe la carpeta raíz de imágenes: {images_root}")

    initialize_firebase(project_id, service_account)

    db = firestore.client()
    bucket = gcs_storage.Client(project=project_id).bucket(f"{project_id}.appspot.com")

    with open(csv_path, newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    print(f"Se encontraron {len(rows)} filas en el CSV")

    for idx, row in enumerate(rows, start=2):
        code = resolve_value(row, "codigo", "code", "sku", "id", "product_code")
        if not code:
            print(f"[{idx}] Se omite porque no tiene código")
            continue

        folder = find_product_folder(images_root_path, row)
        if folder is None:
            print(f"[{idx}] No se encontró carpeta de imágenes para {code}")

        image_files = find_image_files(folder) if folder else []
        image_urls = []

        if not dry_run:
            for image_file in image_files:
                destination = f"productos/{code}/{image_file.name}"
                url = upload_image_to_storage(bucket, image_file, destination)
                image_urls.append(url)

        product_data = {
            "codigo": code,
            "nombre": resolve_value(row, "nombre", "title", "product_name"),
            "descripcion": resolve_value(row, "descripcion", "description", "details"),
            "precio": float(resolve_value(row, "precio", "price") or 0),
            "precioOferta": float(resolve_value(row, "preciooferta", "price_offer") or 0),
            "oferta": 1 if resolve_value(row, "oferta", "has_offer") in {"1", "true", "True", "sí", "si"} else 0,
            "categoriaId": resolve_value(row, "categoria", "category", "categoriaId"),
            "imagenes": image_urls,
            "cantidad": int(resolve_value(row, "cantidad", "stock") or 0),
            "createdAt": int(__import__("time").time() * 1000),
        }

        if dry_run:
            print(f"[{idx}] {code}: {len(image_files)} imagen(es) listas para subir")
            continue

        doc_ref = db.collection(collection).document(code)
        doc_ref.set(product_data)
        print(f"[{idx}] {code}: producto subido con {len(image_urls)} imagen(es)")


if __name__ == "__main__":
    args = parse_args()
    try:
        import_csv(
            csv_path=args.csv,
            images_root=args.images_root,
            project_id=args.project_id,
            service_account=args.service_account,
            collection=args.collection,
            dry_run=args.dry_run,
        )
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)
