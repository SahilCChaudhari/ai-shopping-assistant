import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, 'database', 'commerce.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
     # Frontend URL
     
# Frontend URL
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://127.0.0.1:5000')
    
    # Stripe Configuration - FIX: Use the VARIABLE NAMES, not the values
    STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')
    STRIPE_PUBLISHABLE_KEY = os.getenv('STRIPE_PUBLISHABLE_KEY')
    STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET')
    
    # Mock Payment Mode
    USE_MOCK_PAYMENT = os.getenv('USE_MOCK_PAYMENT', 'true').lower() == 'true'