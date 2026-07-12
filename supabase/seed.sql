-- FitTrack seed data — 2026/7/11 (土) workout record
--
-- Usage:
--   1. Run migrations/001_initial.sql first
--   2. Create a user account via Google login in the app
--   3. Find your user ID in: Supabase Dashboard > Authentication > Users
--   4. Replace USER_ID_HERE below with your actual UUID
--   5. Run this script in: Supabase Dashboard > SQL Editor > New Query

DO $$
DECLARE
  target_user_id uuid := 'USER_ID_HERE'::uuid;
BEGIN
  INSERT INTO records (id, user_id, full_date, date, day, type, category, exercises)
  VALUES (
    1720656000000,
    target_user_id,
    '2026-07-11T12:00:00Z',
    '7/11',
    '土',
    'workout',
    '上半身（押す・引く・肩）＋体幹',
    '[
      {
        "name": "チンニング",
        "type": "normal",
        "targetSets": 4,
        "interval": 90,
        "equipmentType": "assist",
        "inherited": false,
        "options": [
          {"label": "ー", "weight": 0},
          {"label": "1本 (-24kg)", "weight": -24},
          {"label": "2本 (-47kg)", "weight": -47},
          {"label": "3本 (-70kg)", "weight": -70}
        ],
        "sets": [
          {"setNumber": 1, "reps": 6, "weight": -47, "completed": true},
          {"setNumber": 2, "reps": 8, "weight": -47, "completed": true},
          {"setNumber": 3, "reps": 3, "weight": -47, "completed": true},
          {"setNumber": 4, "reps": 3, "weight": -47, "completed": true}
        ]
      },
      {
        "name": "プッシュアップ",
        "type": "normal",
        "targetSets": 4,
        "interval": 90,
        "equipmentType": "bodyweight",
        "inherited": false,
        "options": [{"label": "ー", "weight": 0}],
        "sets": [
          {"setNumber": 1, "reps": 12, "weight": 0, "completed": true},
          {"setNumber": 2, "reps": 8,  "weight": 0, "completed": true},
          {"setNumber": 3, "reps": 5,  "weight": 0, "completed": true},
          {"setNumber": 4, "reps": 4,  "weight": 0, "completed": true}
        ]
      },
      {
        "name": "チューブ・ベントオーバーロウ",
        "type": "normal",
        "targetSets": 4,
        "interval": 60,
        "equipmentType": "tube",
        "inherited": false,
        "options": [
          {"label": "ー", "weight": 0},
          {"label": "赤 (+9kg)", "weight": 9},
          {"label": "黒 (+28kg)", "weight": 28},
          {"label": "紫 (+49.5kg)", "weight": 49.5},
          {"label": "緑 (+66.5kg)", "weight": 66.5}
        ],
        "sets": [
          {"setNumber": 1, "reps": 20, "weight": 28, "completed": true},
          {"setNumber": 2, "reps": 20, "weight": 28, "completed": true},
          {"setNumber": 3, "reps": 20, "weight": 28, "completed": true},
          {"setNumber": 4, "reps": 20, "weight": 28, "completed": true}
        ]
      },
      {
        "name": "アシスト・ディップス",
        "type": "normal",
        "targetSets": 4,
        "interval": 90,
        "equipmentType": "assist",
        "inherited": false,
        "options": [
          {"label": "ー", "weight": 0},
          {"label": "1本 (-24kg)", "weight": -24},
          {"label": "2本 (-47kg)", "weight": -47},
          {"label": "3本 (-70kg)", "weight": -70}
        ],
        "sets": [
          {"setNumber": 1, "reps": 10, "weight": -47, "completed": true},
          {"setNumber": 2, "reps": 7,  "weight": -47, "completed": true},
          {"setNumber": 3, "reps": 6,  "weight": -47, "completed": true},
          {"setNumber": 4, "reps": 5,  "weight": -47, "completed": true}
        ]
      },
      {
        "name": "チューブ・オーバーヘッドプレス",
        "type": "normal",
        "targetSets": 4,
        "interval": 90,
        "equipmentType": "tube",
        "inherited": false,
        "options": [
          {"label": "ー", "weight": 0},
          {"label": "赤 (+9kg)", "weight": 9},
          {"label": "黒 (+28kg)", "weight": 28},
          {"label": "紫 (+49.5kg)", "weight": 49.5},
          {"label": "緑 (+66.5kg)", "weight": 66.5}
        ],
        "sets": [
          {"setNumber": 1, "reps": 14, "weight": 28, "completed": true},
          {"setNumber": 2, "reps": 9,  "weight": 28, "completed": true},
          {"setNumber": 3, "reps": 8,  "weight": 28, "completed": true},
          {"setNumber": 4, "reps": 7,  "weight": 28, "completed": true}
        ]
      },
      {
        "name": "ハンギングニーレイズ",
        "type": "normal",
        "targetSets": 4,
        "interval": 60,
        "equipmentType": "bodyweight",
        "inherited": false,
        "options": [{"label": "ー", "weight": 0}],
        "sets": [
          {"setNumber": 1, "reps": 10, "weight": 0, "completed": true},
          {"setNumber": 2, "reps": 10, "weight": 0, "completed": true},
          {"setNumber": 3, "reps": 10, "weight": 0, "completed": true},
          {"setNumber": 4, "reps": 10, "weight": 0, "completed": true}
        ]
      }
    ]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Seed data inserted for user %', target_user_id;
END $$;
