import { Schema, model, Document } from 'mongoose';

interface IJobPosting extends Document {
  url: string;
  title: string;
  company: string;
  description: string;
  requirements: string[];
  qualifications: string[];
  location?: string;
  salaryRange?: string;
  employmentType?: string;
  department?: string;
  experienceLevel?: string;
  benefits?: string[];
  applicationDeadline?: Date;
  sourceJobBoard: string;
  rawContent: string;
  extractedAt: Date;
  metadata: {
    scrapingMethod: string;
    parseSuccess: boolean;
    errorMessage?: string;
    contentLength: number;
    language?: string;
  };
  isActive: boolean;
  userId?: string;
  tags?: string[];
  applicationCount?: number;
}

const jobPostingSchema = new Schema<IJobPosting>({
  url: { 
    type: String, 
    required: true, 
    unique: true,
    validate: {
      validator: function(v: string) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'URL must be a valid HTTP/HTTPS URL'
    }
  },
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },
  company: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String, 
    required: true,
    maxlength: 10000
  },
  requirements: [{ 
    type: String,
    trim: true
  }],
  qualifications: [{ 
    type: String,
    trim: true
  }],
  location: { 
    type: String,
    trim: true,
    maxlength: 100
  },
  salaryRange: { 
    type: String,
    trim: true,
    maxlength: 50
  },
  employmentType: { 
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'temporary', 'internship', 'freelance'],
    lowercase: true
  },
  department: { 
    type: String,
    trim: true,
    maxlength: 100
  },
  experienceLevel: { 
    type: String,
    enum: ['entry-level', 'mid-level', 'senior-level', 'executive', 'internship'],
    lowercase: true
  },
  benefits: [{ 
    type: String,
    trim: true
  }],
  applicationDeadline: { 
    type: Date
  },
  sourceJobBoard: { 
    type: String, 
    required: true,
    enum: ['linkedin', 'indeed', 'glassdoor', 'company-website', 'other'],
    lowercase: true
  },
  rawContent: { 
    type: String, 
    required: true
  },
  extractedAt: { 
    type: Date, 
    default: Date.now
  },
  metadata: {
    scrapingMethod: { 
      type: String, 
      required: true,
      enum: ['puppeteer', 'cheerio', 'api', 'manual']
    },
    parseSuccess: { 
      type: Boolean, 
      default: false
    },
    errorMessage: { 
      type: String,
      maxlength: 500
    },
    contentLength: { 
      type: Number, 
      required: true,
      min: 0
    },
    language: { 
      type: String,
      default: 'en',
      maxlength: 10
    }
  },
  isActive: { 
    type: Boolean, 
    default: true
  },
  userId: { 
    type: String,
    index: true
  },
  tags: [{ 
    type: String,
    trim: true,
    lowercase: true
  }],
  applicationCount: { 
    type: Number, 
    default: 0,
    min: 0
  }
}, { 
  timestamps: true,
  indexes: [
    { url: 1 },
    { company: 1, title: 1 },
    { sourceJobBoard: 1 },
    { userId: 1, createdAt: -1 },
    { isActive: 1, extractedAt: -1 }
  ]
});

// Pre-save middleware to extract content length
jobPostingSchema.pre('save', function(next) {
  if (this.rawContent) {
    this.metadata.contentLength = this.rawContent.length;
  }
  next();
});

// Instance methods
jobPostingSchema.methods.markAsApplied = function() {
  this.applicationCount = (this.applicationCount || 0) + 1;
  return this.save();
};

jobPostingSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Static methods
jobPostingSchema.statics.findByJobBoard = function(jobBoard: string) {
  return this.find({ sourceJobBoard: jobBoard, isActive: true });
};

jobPostingSchema.statics.findByUser = function(userId: string) {
  return this.find({ userId, isActive: true }).sort({ createdAt: -1 });
};

export const JobPosting = model<IJobPosting>('JobPosting', jobPostingSchema);