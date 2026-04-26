#!/usr/bin/env python
"""
MySQL Setup Script for Fake News Detection Project
This script helps set up MySQL database and install required packages
"""

import subprocess
import sys
import os

def install_packages():
    """Install required Python packages"""
    print("Installing required packages...")
    
    packages = [
        'mysqlclient>=2.1.0',
        'django-cors-headers>=4.0.0'
    ]
    
    for package in packages:
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
            print(f"✅ Installed {package}")
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install {package}: {e}")
            return False
    
    return True

def create_mysql_database():
    """Create MySQL database"""
    print("\nSetting up MySQL database...")
    print("Please make sure MySQL is running and you have root access.")
    
    # Database configuration
    db_name = 'fake_news_detection'
    db_user = 'root'
    db_password = ''  # Update this if you have a password
    
    try:
        # Create database
        create_db_sql = f"CREATE DATABASE IF NOT EXISTS {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        
        if db_password:
            cmd = ['mysql', '-u', db_user, f'-p{db_password}', '-e', create_db_sql]
        else:
            cmd = ['mysql', '-u', db_user, '-e', create_db_sql]
        
        subprocess.check_call(cmd)
        print(f"✅ Created database: {db_name}")
        
        # Create user (optional)
        create_user_sql = f"""
        CREATE USER IF NOT EXISTS 'fake_news_user'@'localhost' IDENTIFIED BY 'fake_news_password';
        GRANT ALL PRIVILEGES ON {db_name}.* TO 'fake_news_user'@'localhost';
        FLUSH PRIVILEGES;
        """
        
        if db_password:
            cmd = ['mysql', '-u', db_user, f'-p{db_password}', '-e', create_user_sql]
        else:
            cmd = ['mysql', '-u', db_user, '-e', create_user_sql]
        
        subprocess.check_call(cmd)
        print("✅ Created database user: fake_news_user")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to create database: {e}")
        print("Please make sure MySQL is running and you have proper permissions.")
        return False
    except FileNotFoundError:
        print("❌ MySQL command not found. Please install MySQL and add it to your PATH.")
        return False

def run_migrations():
    """Run Django migrations"""
    print("\nRunning Django migrations...")
    
    try:
        # Make migrations
        subprocess.check_call([sys.executable, 'manage.py', 'makemigrations'])
        print("✅ Created migrations")
        
        # Migrate
        subprocess.check_call([sys.executable, 'manage.py', 'migrate'])
        print("✅ Applied migrations")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to run migrations: {e}")
        return False

def create_superuser():
    """Create Django superuser"""
    print("\nCreating Django superuser...")
    print("You can skip this by pressing Ctrl+C")
    
    try:
        subprocess.check_call([sys.executable, 'manage.py', 'createsuperuser'])
        print("✅ Created superuser")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to create superuser: {e}")
        return False
    except KeyboardInterrupt:
        print("⏭️ Skipped superuser creation")
        return True

def main():
    """Main setup function"""
    print("=" * 60)
    print("FAKE NEWS DETECTION - MYSQL SETUP")
    print("=" * 60)
    
    # Check if we're in the right directory
    if not os.path.exists('manage.py'):
        print("❌ Please run this script from the project root directory (where manage.py is located)")
        return
    
    # Install packages
    if not install_packages():
        print("❌ Failed to install packages")
        return
    
    # Create database
    if not create_mysql_database():
        print("❌ Failed to create database")
        return
    
    # Run migrations
    if not run_migrations():
        print("❌ Failed to run migrations")
        return
    
    # Create superuser
    create_superuser()
    
    print("\n" + "=" * 60)
    print("✅ SETUP COMPLETED SUCCESSFULLY!")
    print("=" * 60)
    print("You can now:")
    print("1. Start the server: python manage.py runserver")
    print("2. Access the admin panel: http://127.0.0.1:8000/admin")
    print("3. Use the fake news detection app: http://127.0.0.1:8000")
    print("4. View dashboard: http://127.0.0.1:8000/dashboard")
    print("\nDatabase tables created:")
    print("- Rating (user ratings and feedback)")
    print("- NewsAnalysis (analysis results with IP tracking)")
    print("- UserFeedback (user feedback on predictions)")
    print("- SystemMetrics (system performance metrics)")

if __name__ == "__main__":
    main()
