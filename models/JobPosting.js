import { Schema, model, Document } from 'mongoose';

interface IJobPosting extends Document {
  url: string;
  title: string;
  company: string;
  location?: string;
  description: string;
  requirements: string[];
  skills: string[];
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
    period?: 'hourly' | 'daily' | 'monthly' | 'yearly';
  };
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship';
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
  platform: string;
  platformId?: string;
  postedDate?: Date;
  applicationDeadline?: Date;
  benefits?: string[];
  department?: string;
  industry?: string;
  workMode?: 'remote' | 'hybrid' | 'onsite';
  parsedData: {
    rawHtml?: string;
    lastParsed: Date;
    parseSuccess: boolean;
    parseErrors?: string[];
    extractedFields: {
      title: boolean;
      company: boolean;
      description: boolean;
      requirements: boolean;
      skills: boolean;
    };
  };
  userId?: Schema.Types.ObjectId;
  status: 'active' | 'expired' | 'filled' | 'removed';
  applicationCount?: number;
  isVerified: boolean;
  tags?: string[];
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
  location: {
    type: String,
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
    trim: true,
    maxlength: 500
  }],
  skills: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  salary: {
    min: {
      type: Number,
      min: 0
    },
    max: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD',
      maxlength: 3
    },
    period: {
      type: String,
      enum: ['hourly', 'daily', 'monthly', 'yearly'],
      default: 'yearly'
    }
  },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'temporary', 'internship'],
    default: 'full-time'
  },
  experienceLevel: {
    type: String,
    enum: ['entry', 'mid', 'senior', 'executive']
  },
  platform: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  platformId: {
    type: String,
    trim: true,
    maxlength: 100
  },
  postedDate: {
    type: Date
  },
  applicationDeadline: {
    type: Date
  },
  benefits: [{
    type: String,
    trim: true,
    maxlength: 100
  }],
  department: {
    type: String,
    trim: true,
    maxlength: 50
  },
  industry: {
    type: String,
    trim: true,
    maxlength: 50
  },
  workMode: {
    type: String,
    enum: ['remote', 'hybrid', 'onsite']
  },
  parsedData: {
    rawHtml: {
      type: String
    },
    lastParsed: {
      type: Date,
      required: true,
      default: Date.now
    },
    parseSuccess: {
      type: Boolean,
      required: true,
      default: false
    },
    parseErrors: [{
      type: String
    }],
    extractedFields: {
      title: {
        type: Boolean,
        default: false
      },
      company: {
        type: Boolean,
        default: false
      },
      description: {
        type: Boolean,
        default: false
      },
      requirements: {
        type: Boolean,
        default: false
      },
      skills: {
        type: Boolean,
        default: false
      }
    }
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'filled', 'removed'],
    default: 'active'
  },
  applicationCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 30
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
jobPostingSchema.index({ url: 1 });
jobPostingSchema.index({ platform: 1, platformId: 1 });
jobPostingSchema.index({ userId: 1, createdAt: -1 });
jobPostingSchema.index({ company: 1, title: 1 });
jobPostingSchema.index({ status: 1, createdAt: -1 });
jobPostingSchema.index({ skills: 1 });
jobPostingSchema.index({ 'parsedData.parseSuccess': 1 });

// Virtual for parse quality score
jobPostingSchema.virtual('parseQuality').get(function() {
  const fields = this.parsedData.extractedFields;
  const totalFields = Object.keys(fields).length;
  const extractedFields = Object.values(fields).filter(Boolean).length;
  return totalFields > 0 ? (extractedFields / totalFields) * 100 : 0;
});

// Pre-save middleware to validate salary range
jobPostingSchema.pre('save', function(next) {
  if (this.salary && this.salary.min && this.salary.max && this.salary.min > this.salary.max) {
    next(new Error('Minimum salary cannot be greater than maximum salary'));
  } else {
    next();
  }
});

export const JobPosting = model<IJobPosting>('JobPosting', jobPostingSchema);