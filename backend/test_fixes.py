import os
import sys
import unittest
import json
import io
from fastapi.testclient import TestClient
from app import app, EXPORTS_DIR, BASE_DIR

class TestDiagnosticFixes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_media_check_status_schema_dict(self):
        """Verify check-status works with dict schema { 'paths': [...] }"""
        existing_file = os.path.abspath(__file__)
        non_existing = os.path.join(BASE_DIR, "non_existent_video_12345.mp4")

        payload = {"paths": [existing_file, non_existing]}
        res = self.client.post("/api/media/check-status", json=payload)
        self.assertEqual(res.status_code, 200, f"check-status failed: {res.text}")
        data = res.json()

        self.assertIn("results", data)
        # Should report existing file as True
        self.assertTrue(data["results"].get(existing_file) or data.get(existing_file))
        # Should report non-existing file as False
        self.assertFalse(data["results"].get(non_existing) or data.get(non_existing))

    def test_media_check_status_schema_list(self):
        """Verify check-status works with raw list schema [...]"""
        existing_file = os.path.abspath(__file__)
        payload = [existing_file]
        res = self.client.post("/api/media/check-status", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["results"].get(existing_file) or data.get(existing_file))

    def test_media_check_status_slash_normalization(self):
        """Verify check-status normalizes forward slashes and backslashes"""
        existing_file = os.path.abspath(__file__)
        fwd = existing_file.replace("\\", "/")
        back = existing_file.replace("/", "\\")

        res = self.client.post("/api/media/check-status", json={"paths": [fwd, back]})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["results"].get(fwd) or data.get(fwd))
        self.assertTrue(data["results"].get(back) or data.get(back))

    def test_save_batch_export_and_zip(self):
        """Verify /api/batch/save-export saves real filename and /api/batch/zip-exports zips it"""
        test_filename = f"test_export_video_{int(os.getpid())}.mp4"
        dummy_mp4_content = b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41"

        # 1. Save export
        save_res = self.client.post(
            "/api/batch/save-export",
            files={"file": (test_filename, io.BytesIO(dummy_mp4_content), "video/mp4")},
            data={"filename": test_filename}
        )
        self.assertEqual(save_res.status_code, 200, f"save-export failed: {save_res.text}")
        save_data = save_res.json()
        self.assertEqual(save_data.get("filename"), test_filename)

        saved_path = os.path.join(EXPORTS_DIR, test_filename)
        self.assertTrue(os.path.isfile(saved_path), f"File {saved_path} does not exist on disk")

        # 2. Zip exports
        zip_res = self.client.post(
            "/api/batch/zip-exports",
            json={"filenames": [test_filename], "zip_name": "Test_Batch.zip"}
        )
        self.assertEqual(zip_res.status_code, 200, f"zip-exports failed: {zip_res.text}")
        zip_data = zip_res.json()
        self.assertEqual(zip_data.get("status"), "ready")
        self.assertEqual(zip_data.get("file_count"), 1)
        zip_filename = zip_data.get("zip_filename")
        zip_path = os.path.join(EXPORTS_DIR, zip_filename)
        self.assertTrue(os.path.isfile(zip_path))

        # Cleanup test files
        try:
            if os.path.isfile(saved_path):
                os.remove(saved_path)
            if os.path.isfile(zip_path):
                os.remove(zip_path)
        except Exception:
            pass

    def test_save_project_clean_id_and_retrieve_delete(self):
        """Verify project save sanitizes ID, persists to disk, and can be retrieved & deleted"""
        test_id = f"test-proj_{int(os.getpid())}"
        project_payload = {
            "id": test_id,
            "title": "My Awesome Test Project",
            "aspectRatio": "9:16",
            "duration": 12.5,
            "segments": [
                {
                    "start": 0.0,
                    "end": 2.0,
                    "text": "Hello world",
                    "words": [{"word": "Hello", "start": 0.0, "end": 0.8}, {"word": "world", "start": 0.8, "end": 2.0}]
                }
            ]
        }

        # 1. Save
        save_res = self.client.post("/api/projects", json=project_payload)
        self.assertEqual(save_res.status_code, 200)
        save_data = save_res.json()
        self.assertEqual(save_data.get("status"), "saved")
        self.assertEqual(save_data["project"]["title"], "My Awesome Test Project")

        # 2. Get by ID
        get_res = self.client.get(f"/api/projects/{test_id}")
        self.assertEqual(get_res.status_code, 200)
        get_data = get_res.json()
        self.assertEqual(get_data.get("title"), "My Awesome Test Project")

        # 3. List
        list_res = self.client.get("/api/projects")
        self.assertEqual(list_res.status_code, 200)
        list_data = list_res.json()
        matching = [p for p in list_data.get("projects", []) if p.get("id") == test_id]
        self.assertEqual(len(matching), 1)

        # 4. Delete
        del_res = self.client.delete(f"/api/projects/{test_id}")
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.json().get("status"), "deleted")

        # Verify 404 after deletion
        get_after_del = self.client.get(f"/api/projects/{test_id}")
        self.assertEqual(get_after_del.status_code, 404)

    def test_zip_exports_with_alternate_extension(self):
        """Verify /api/batch/zip-exports finds files even if .mp4 is omitted in request"""
        test_filename = f"test_no_ext_{int(os.getpid())}.mp4"
        dummy_mp4_content = b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41"

        save_res = self.client.post(
            "/api/batch/save-export",
            files={"file": (test_filename, io.BytesIO(dummy_mp4_content), "video/mp4")},
            data={"filename": test_filename}
        )
        self.assertEqual(save_res.status_code, 200)
        saved_path = os.path.join(EXPORTS_DIR, test_filename)

        # Zip using name without .mp4 extension
        raw_name = test_filename[:-4]
        zip_res = self.client.post(
            "/api/batch/zip-exports",
            json={"filenames": [raw_name], "zip_name": "Test_Batch_NoExt.zip"}
        )
        self.assertEqual(zip_res.status_code, 200, f"zip-exports failed: {zip_res.text}")
        zip_data = zip_res.json()
        self.assertEqual(zip_data.get("file_count"), 1)
        zip_path = os.path.join(EXPORTS_DIR, zip_data.get("zip_filename"))

        try:
            if os.path.isfile(saved_path):
                os.remove(saved_path)
            if os.path.isfile(zip_path):
                os.remove(zip_path)
        except Exception:
            pass

if __name__ == "__main__":
    unittest.main()
